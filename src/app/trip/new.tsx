// Nouvelle course / Modifier: log fast in the shop (typed), or review a scanned ticket.
// After a scan: only « N articles lus · Ticket X DH », a dashed « à vérifier » note when the
// lines don't add up, a retry card when Gemini fails, and « Même produit que … ? » for
// receipt spellings close to a known product (the answer is remembered as an alias).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollViewInstance, TextInputInstance } from 'react-native';
import { Alert } from '@/alert';
import { Icon } from '@/components/icon';
import { Pop } from '@/components/motion';
import { showToast } from '@/components/toast';
import { Button, CheckChip, Empty, Field, Group, IconButton, Notice, Pill, PriceChip, Screen, Tile, TopBar, VerdictChip, s as ui, t } from '@/components/ui';
import { addAlias, findProduct, getPref, getTrip, listProducts, listStores, saveTrip, setPref, type ProductRow } from '@/db';
import { addDays, cleanName, closestName, dh, longDate, money, parseNumber, perUnit, plural, productKey, qty as fmtQty, qtyLabel, todayIso, verdict } from '@/format';
import { STAMP_DUTY } from '@/receipt';
import { readPhoto, scanAvailable, scanReceipt, type Photo, type ScanResult } from '@/scan';
import { useSQLiteContext } from '@/sqlite';
import { bubble, colors, DEFAULT_STORES, floatShadow, price as pc, sheet, text, UNITS, useTheme } from '@/theme';
import { radius, size, space } from '@/tokens';

/** `last` = usual price of the product (or null: nothing to compare). */
type Line = {
  id: number; name: string; unit: string; qty: number; unitPrice: number; last: number | null; known: boolean;
  scanned?: boolean; unnamed?: boolean; otherUnit?: boolean; promo?: boolean;
  /** receipt spelling to remember as an alias once saved */
  raw?: string;
  /** a known product this receipt spelling looks like */
  suggest?: { name: string; unit: string; avg: number | null };
};
type NewLine = Omit<Line, 'id'>;
type ScanState = { count: number; total: number | null; lines: number; missing: number; unnamed: number; warning?: string; fellBack?: boolean; photo?: Photo; failed?: boolean };
let nextLineId = 1;

const isMeasured = (unit: string) => unit === 'kg' || unit === 'L';
const stepFor = (unit: string) => (isMeasured(unit) ? 0.25 : 1);
const smallUnit = (unit: string) => (unit === 'L' ? 'mL' : 'g');

export default function TripForm() {
  useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string; scan?: string }>();
  const editId = params.id ? Number(params.id) : undefined;

  const [stores, setStores] = useState<string[]>(DEFAULT_STORES);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [store, setStore] = useState('');
  const [otherStore, setOtherStore] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [items, setItems] = useState<Line[]>([]);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<string>(UNITS[0]);
  const [unitPicked, setUnitPicked] = useState(false);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [small, setSmall] = useState(false);
  const [priceMode, setPriceMode] = useState<'unit' | 'total'>('unit');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<ScanState | null>(null);
  const [scanRows, setScanRows] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const nameRef = useRef<TextInputInstance>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const formY = useRef(0);
  /** The last ticket photo, so « Réessayer » works whatever went wrong after the photo. */
  const lastPhoto = useRef<Photo | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [known, used, existing] = await Promise.all([listProducts(db, '', 'frequent'), listStores(db), editId ? getTrip(db, editId) : Promise.resolve(null)]);
      if (!alive) return;
      setProducts(known);
      setLoaded(true);
      const keys = new Set(used.map(productKey));
      setStores([...used, ...DEFAULT_STORES.filter((d) => !keys.has(productKey(d)))]);
      if (existing) {
        setStore(existing.trip.store);
        setDate(existing.trip.date);
        // Editing: comparing with "last time" would include this very trip, so it is not shown.
        setItems(existing.items.map((it) => ({ id: nextLineId++, name: it.name, unit: it.unit, qty: it.qty, unitPrice: it.unit_price, last: null, known: true, promo: !!it.promo })));
      } else {
        // No default store: the scan fills it, or it is picked by hand.
        setSetupOpen(!params.scan);
      }
    })();
    return () => { alive = false; };
  }, [db, editId, params.scan]);

  const byKey = useMemo(() => new Map(products.map((p) => [productKey(p.name), p])), [products]);
  const typedKey = productKey(name);
  const match = byKey.get(typedKey);
  const shownUnit = match && !unitPicked ? match.unit : unit;
  const sameUnit = !match || match.unit === shownUnit;
  const measured = isMeasured(shownUnit);

  const computed = (() => {
    const p = parseNumber(price);
    const typed = parseNumber(quantity);
    if (!(p >= 0) || !(typed > 0)) return null;
    const q = measured && small ? typed / 1000 : typed;
    const unitPrice = measured && priceMode === 'total' ? p / q : p;
    return { qty: Math.round(q * 1000) / 1000, unitPrice: Math.round(unitPrice * 10000) / 10000, paid: q * unitPrice };
  })();
  const hint = !editId && match && sameUnit && computed && price.trim() && match.name !== STAMP_DUTY ? verdict(computed.unitPrice, match.avg_price) : null;

  const basketKeys = new Set(items.map((it) => productKey(it.name)));
  const suggestions = products
    .filter((p) => !basketKeys.has(productKey(p.name)) && p.last_price !== null && !/timbre/i.test(p.name))
    .filter((p) => typedKey.length >= 2 && productKey(p.name).includes(typedKey))
    .slice(0, 6);

  /** Adds a line. Typed items merge with the same product; scanned ones stay separate so duplicates show. */
  const upsert = (line: NewLine, merge = true) => {
    const item: Line = { ...line, id: nextLineId++ };
    const key = productKey(item.name);
    setItems((cur) => {
      const i = merge ? cur.findIndex((x) => productKey(x.name) === key) : -1;
      if (i < 0) return [...cur, item];
      const copy = [...cur];
      copy[i] = { ...copy[i], unitPrice: item.unitPrice, qty: copy[i].qty + item.qty };
      return copy;
    });
  };

  const resetForm = () => {
    setName(''); setPrice(''); setQuantity('1'); setSmall(false); setPriceMode('unit'); setUnit(UNITS[0]); setUnitPicked(false); setError('');
  };

  const addTyped = () => {
    const clean = cleanName(name);
    if (!productKey(clean)) return setError("Écris le nom de l'article.");
    if (!computed) return setError(measured ? 'Écris le poids et le prix, par exemple 750 g et 6,50.' : 'Écris le prix, par exemple 12,50, et une quantité plus grande que zéro.');
    upsert({ name: match ? match.name : clean, unit: shownUnit, qty: computed.qty, unitPrice: computed.unitPrice, last: editId || !sameUnit ? null : match?.avg_price ?? null, known: !!match });
    resetForm();
    nameRef.current?.focus();
  };

  const addSuggestion = (p: ProductRow) => {
    upsert({ name: p.name, unit: p.unit, qty: 1, unitPrice: p.last_price ?? 0, last: editId ? null : p.avg_price, known: true });
    setName('');
    setError('');
    nameRef.current?.focus();
  };

  const update = (id: number, patch: Partial<Line>) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const changeQty = (id: number, direction: 1 | -1) =>
    setItems((cur) => cur.flatMap((it) => {
      if (it.id !== id) return [it];
      const next = Math.round((it.qty + direction * stepFor(it.unit)) * 1000) / 1000;
      return next <= 0 ? [] : [{ ...it, qty: next }];
    }));
  const removeLine = (id: number) => setItems((cur) => cur.filter((x) => x.id !== id));

  /** Moves a basket line back into the form so its price, quantity or unit can be corrected. */
  const editLine = (it: Line) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, formY.current - space.md), animated: true });
    nameRef.current?.focus();
    setName(it.unnamed ? '' : it.name);
    setUnit(it.unit);
    setUnitPicked(true);
    setPriceMode('unit');
    setPrice(String(Math.round(it.unitPrice * 100) / 100).replace('.', ','));
    if (isMeasured(it.unit) && it.qty < 1) { setSmall(true); setQuantity(String(Math.round(it.qty * 1000))); }
    else { setSmall(false); setQuantity(fmtQty(it.qty)); }
    removeLine(it.id);
  };

  const acceptSuggest = (it: Line) => {
    if (!it.suggest) return;
    const same = it.suggest.unit === it.unit;
    update(it.id, { name: it.suggest.name, raw: it.raw ?? it.name, known: true, last: editId || !same ? null : it.suggest.avg, suggest: undefined });
  };

  const total = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);

  /** Fills the basket from a scan result (replacing an earlier scan's lines on retry). */
  const applyScan = async (res: ScanResult) => {
    setScanRows(res.rows);
    if (res.items.length === 0) {
      setScan({ count: 0, total: res.total, lines: 0, missing: 0, unnamed: 0, warning: res.warning, fellBack: res.fellBack, photo: res.photo, failed: true });
      return;
    }
    if (res.store) {
      const known = stores.find((x) => productKey(x) === productKey(res.store!));
      setOtherStore(!known);
      setStore(known ?? res.store);
      setSetupOpen(false);
    } else setSetupOpen(true);
    if (res.date && res.date <= todayIso()) setDate(res.date);
    const lines: NewLine[] = [];
    for (const it of res.items) {
      // Same matching as v3 (exact name), then — as an extra that can never break the scan —
      // a remembered receipt spelling (alias).
      let existing: ProductRow | null | undefined = it.unnamed ? undefined : byKey.get(productKey(it.name));
      if (!existing && !it.unnamed) existing = await findProduct(db, it.name).catch(() => null);
      let lineName = existing ? existing.name : it.name;
      const otherUnit = !!existing && existing.unit !== it.unit;
      if (otherUnit) {
        lineName = `${existing!.name} (${it.unit})`;
        existing = byKey.get(productKey(lineName));
      }
      let close: ProductRow | null = null;
      try {
        close = !existing && !it.unnamed && it.name !== STAMP_DUTY ? closestName(it.name, products.filter((p) => !/timbre/i.test(p.name))) : null;
      } catch {
        close = null;
      }
      lines.push({
        name: lineName, otherUnit, unit: existing ? existing.unit : it.unit, qty: it.qty, unitPrice: it.unitPrice,
        last: editId ? null : existing?.avg_price ?? null, known: !!existing, scanned: true, unnamed: it.unnamed,
        suggest: close ? { name: close.name, unit: close.unit, avg: close.avg_price } : undefined,
      });
    }
    setItems((cur) => [...cur.filter((x) => !x.scanned), ...lines.map((l) => ({ ...l, id: nextLineId++ }))]);
    const products_ = res.items.filter((i) => i.name !== STAMP_DUTY);
    const units = products_.reduce((n, i) => n + (i.unit === 'pièce' && Number.isInteger(i.qty) ? i.qty : 1), 0);
    setScan({
      count: products_.length,
      total: res.total,
      lines: res.items.reduce((a, i) => a + i.qty * i.unitPrice, 0),
      missing: res.expected !== null && res.expected > units ? res.expected - units : 0,
      unnamed: res.items.filter((i) => i.unnamed).length,
      warning: res.warning,
      fellBack: res.fellBack,
      photo: res.photo,
    });
  };

  const runScan = async (source: 'camera' | 'gallery' | 'photo' | 'retry') => {
    setError('');
    setScanning(true);
    try {
      const key = await getPref(db, 'geminiKey');
      const model = await getPref(db, 'geminiModel');
      const res = source === 'retry' ? (lastPhoto.current ? await readPhoto(lastPhoto.current, key, model) : null) : await scanReceipt(source, key, model);
      if (!res) return;
      if (res.photo) lastPhoto.current = res.photo;
      if (res.model && res.model !== model) await setPref(db, 'geminiModel', res.model);
      await applyScan(res);
    } catch (e) {
      setScan({ count: 0, total: null, lines: 0, missing: 0, unnamed: 0, warning: String((e as Error).message ?? e), failed: true, photo: lastPhoto.current });
    } finally {
      setScanning(false);
    }
  };

  // Opened from the + menu or the camera: go straight to reading the ticket.
  const autoScan = useRef(false);
  useEffect(() => {
    if (!loaded || autoScan.current || editId || (params.scan !== 'camera' && params.scan !== 'gallery' && params.scan !== 'photo')) return;
    autoScan.current = true;
    runScan(params.scan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const verdicts = items.map((it) => (it.name === STAMP_DUTY ? null : verdict(it.unitPrice, it.last)));
  const n = (k: 'good' | 'normal' | 'high') => verdicts.filter((v) => v?.kind === k).length;

  const save = async () => {
    if (!cleanName(store)) { setSetupOpen(true); return setError('Choisis le magasin.'); }
    if (items.length === 0) return setError('Ajoute au moins un article.');
    if (items.some((it) => it.unnamed)) return setError('Écris le nom des articles marqués « Nom à écrire » (bouton Modifier).');
    if (productKey(name) || price.trim()) return setError("Un article est en cours de saisie. Touche + pour l'ajouter, ou efface-le.");
    setSaving(true);
    try {
      await setPref(db, 'lastStore', cleanName(store));
      await saveTrip(db, { id: editId, store, date, items: items.map((it) => ({ name: it.name, unit: it.unit, qty: it.qty, unitPrice: it.unitPrice, promo: it.promo })) });
      for (const it of items) {
        if (!it.raw) continue;
        // Remembering a spelling is a bonus: the trip is already saved if this fails.
        try {
          const p = await findProduct(db, it.name);
          if (p) await addAlias(db, it.raw, p.id);
        } catch {}
      }
      showToast(editId ? 'Course modifiée' : `Bsse7a ! Course enregistrée · ${dh(total)}`);
      if (router.canGoBack()) router.back();
      else router.replace('/trips');
    } catch (e) {
      setSaving(false);
      Alert.alert("L'enregistrement a échoué", String((e as Error).message ?? e));
    }
  };

  const today = todayIso();
  const gap = scan && scan.total !== null && !scan.failed ? Math.abs(scan.total - scan.lines) : 0;

  return (
    <Screen>
      <TopBar
        title={editId ? 'Modifier la course' : 'Nouvelle course'}
        right={editId ? undefined : (
          <View style={st.headActions}>
            <IconButton icon="camera" label="Scanner le ticket" tone="surface" disabled={scanning} onPress={() => (scanAvailable ? router.replace('/camera') : runScan('camera'))} />
            <IconButton icon="gallery" label="Ticket depuis la galerie" tone="surface" disabled={scanning} onPress={() => runScan('gallery')} />
          </View>
        )}
      />
      <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" accessibilityLabel="Changer le magasin ou la date" accessibilityState={{ expanded: setupOpen }} onPress={() => setSetupOpen((o) => !o)} style={({ pressed }) => [st.summary, pressed && ui.pressed]}>
            <Tile kind="store" text={store || 'magasin'} />
            <View style={ui.flex}>
              <Text style={t.name} numberOfLines={1}>{cleanName(store) || 'Choisis le magasin'}</Text>
              <Text style={t.meta}>{date === today ? "Aujourd'hui" : longDate(date)}</Text>
            </View>
            <Icon name={setupOpen ? 'up' : 'down'} size={size.iconDense} color={colors.muted} />
          </Pressable>

          {setupOpen ? (
            <View style={st.setup}>
              <View style={st.dateRow}>
                <IconButton icon="back" label="Jour précédent" tone="surface" onPress={() => setDate(addDays(date, -1))} />
                <View style={st.dateBox}>
                  <Text style={t.name}>{date === today ? "Aujourd'hui" : longDate(date)}</Text>
                  {date === today ? <Text style={t.meta}>{longDate(date)}</Text> : null}
                </View>
                <IconButton icon="next" label="Jour suivant" tone="surface" disabled={date >= today} onPress={() => setDate(addDays(date, 1))} />
              </View>
              <Text style={t.label}>OÙ AS-TU FAIT TES COURSES ?</Text>
              <View style={st.wrap}>
                {stores.map((x) => (
                  <Pill key={x} label={x} active={!otherStore && productKey(store) === productKey(x)} onPress={() => { setOtherStore(false); setStore(x); setError(''); setSetupOpen(false); }} />
                ))}
                <Pill label="Autre" icon="plus" active={otherStore} onPress={() => { setOtherStore(true); setStore(''); }} />
              </View>
              {otherStore ? <Field accessibilityLabel="Nom du magasin" value={store} onChangeText={setStore} placeholder="Nom du magasin" autoFocus returnKeyType="done" onSubmitEditing={() => setSetupOpen(false)} /> : null}
            </View>
          ) : null}

          {scanning ? <Notice icon="scan" text="Je lis le ticket… (5 à 15 secondes)" /> : null}

          {scan && !scanning ? (
            scan.failed ? (
              <View style={st.failCard} accessibilityLiveRegion="polite">
                <View style={st.failHead}>
                  <Icon name={scan.fellBack ? 'offline' : 'check2'} color={colors.ink} />
                  <Text style={[t.name, ui.flex]}>Ticket non lu</Text>
                </View>
                <Text style={t.body}>{scan.warning ?? "Aucun article reconnu. Reprends la photo bien à plat, avec de la lumière."}</Text>
                <View style={st.failActions}>
                  {scan.photo ? <Button compact kind="primary" icon="retry" label="Réessayer" onPress={() => runScan('retry')} /> : null}
                  <Button compact kind="outline" icon="camera" label="Reprendre la photo" onPress={() => (scanAvailable ? router.replace('/camera') : runScan('camera'))} />
                  <Button compact kind="quiet" icon="manual" label="Saisir à la main" onPress={() => { setScan(null); nameRef.current?.focus(); }} />
                </View>
              </View>
            ) : (
              <View style={st.scanCard}>
                <View style={st.scanHead}>
                  <Icon name="receipt" color={colors.onPrimaryContainer} />
                  <Text style={st.scanText}>{plural(scan.count, 'article lu', 'articles lus')}{scan.total !== null ? ` · Ticket ${dh(scan.total)}` : ''}</Text>
                  {scanRows.length ? <IconButton icon="text" label="Voir le texte lu" onPress={() => Alert.alert('Texte lu sur le ticket', scanRows.join('\n'))} /> : null}
                </View>
                {gap > 0.5 ? <CheckChip label={`Les lignes font ${dh(scan.lines)} : vérifie s'il en manque`} /> : null}
                {scan.missing > 0 ? <CheckChip label={`Le ticket compte ${scan.missing} article${scan.missing > 1 ? 's' : ''} de plus`} /> : null}
                {scan.unnamed > 0 ? <CheckChip label={`${scan.unnamed} nom${scan.unnamed > 1 ? 's' : ''} à écrire`} /> : null}
                {scan.fellBack && scan.warning ? (
                  <View style={st.fallback}>
                    <Text style={[t.meta, ui.flex]}>{scan.warning}</Text>
                    {scan.photo ? <Button compact kind="quiet" icon="retry" label="Réessayer" onPress={() => runScan('retry')} /> : null}
                  </View>
                ) : null}
              </View>
            )
          ) : null}

          <View onLayout={(e) => { formY.current = e.nativeEvent.layout.y; }} style={st.form}>
            <Text style={t.label}>ARTICLE</Text>
            <Field ref={nameRef} autoFocus={!editId && !params.scan} accessibilityLabel="Nom de l'article" value={name} onChangeText={(v) => { setName(v); setError(''); }} placeholder="Ex. Farine 5kg" autoCapitalize="sentences" returnKeyType="next" />
            {suggestions.length > 0 ? (
              <View style={st.wrap}>
                {suggestions.map((p) => (
                  <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Ajouter ${p.name} à ${money(p.last_price ?? 0)} dirhams`} onPress={() => addSuggestion(p)} style={({ pressed }) => [st.suggest, pressed && ui.pressed]}>
                    <Text style={st.suggestText} numberOfLines={1}>{p.name}</Text>
                    <Text style={st.suggestPrice}>{money(p.last_price ?? 0)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={t.label}>{match && !sameUnit ? `VENDU PAR (AVANT : ${match.unit.toUpperCase()})` : 'VENDU PAR'}</Text>
            <View style={st.wrap}>
              {UNITS.map((u) => <Pill key={u} label={u} active={shownUnit === u} onPress={() => { setUnit(u); setUnitPicked(true); setError(''); }} />)}
            </View>

            {measured ? (
              <>
                <Text style={t.label}>{shownUnit === 'kg' ? 'POIDS ACHETÉ' : 'VOLUME ACHETÉ'}</Text>
                <View style={st.inline}>
                  <Field accessibilityLabel={`Quantité en ${small ? smallUnit(shownUnit) : shownUnit}`} value={quantity} onChangeText={(v) => { setQuantity(v); setError(''); }} keyboardType="decimal-pad" selectTextOnFocus style={[ui.flex, st.num]} />
                  <Pill label={smallUnit(shownUnit)} active={small} onPress={() => setSmall(true)} />
                  <Pill label={shownUnit} active={!small} onPress={() => setSmall(false)} />
                </View>
                <View style={st.wrap}>
                  <Pill label={`Prix du ${shownUnit === 'kg' ? 'kilo' : 'litre'}`} active={priceMode === 'unit'} onPress={() => setPriceMode('unit')} />
                  <Pill label="Ce que j'ai payé" active={priceMode === 'total'} onPress={() => setPriceMode('total')} />
                </View>
              </>
            ) : null}

            <View style={st.numbers}>
              <View style={ui.flex}>
                <Text style={t.label}>{measured && priceMode === 'total' ? 'PRIX PAYÉ (DH)' : `PRIX POUR 1 ${shownUnit.toUpperCase()}`}</Text>
                <Field accessibilityLabel="Prix en dirhams" value={price} onChangeText={(v) => { setPrice(v); setError(''); }} placeholder="0,00" keyboardType="decimal-pad" style={st.num} />
              </View>
              {measured ? null : (
                <View style={st.qtyBox}>
                  <Text style={t.label}>QTÉ</Text>
                  <Field accessibilityLabel="Quantité" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" selectTextOnFocus style={st.num} />
                </View>
              )}
              <IconButton icon="plus" label="Ajouter l'article" tone="primary" onPress={addTyped} />
            </View>
            {hint ? (
              <View accessibilityLiveRegion="polite" style={st.hintRow}>
                <VerdictChip v={hint} />
                <Text style={t.meta}>d'habitude {money(match?.avg_price ?? 0)} DH{perUnit(shownUnit)}</Text>
              </View>
            ) : null}
            {measured && computed && price.trim() ? (
              <Text style={t.meta} accessibilityLiveRegion="polite">
                {qtyLabel(computed.qty, shownUnit)} · {priceMode === 'total' ? `soit ${money(computed.unitPrice)} DH le ${shownUnit === 'kg' ? 'kilo' : 'litre'}` : `tu paies ${money(computed.paid)} DH`}
              </Text>
            ) : null}
            {error ? <Text style={st.error} accessibilityLiveRegion="polite">{error}</Text> : null}
          </View>

          <View style={st.basketHead}>
            <Text style={st.basketTitle}>Panier</Text>
            <Text style={t.meta}>{plural(items.length, 'article', 'articles')}</Text>
          </View>
          {verdicts.some(Boolean) ? (
            <View style={st.wrap}>
              {n('high') ? <PriceChip dir="up" label={`${n('high')} ghali`} /> : null}
              {n('normal') ? <PriceChip dir="same" label={`${n('normal')} normal`} /> : null}
              {n('good') ? <PriceChip dir="down" label={`${n('good')} rkhis`} /> : null}
            </View>
          ) : null}
          {items.length === 0 ? (
            <Empty icon="market" title="Ton panier est vide" text="Ajoute ton premier article juste au-dessus, ou scanne le ticket." />
          ) : (
            <Group>
              {[...items].reverse().map((it, k) => {
                const v = it.name === STAMP_DUTY ? null : verdict(it.unitPrice, it.last);
                const stamp = it.name === STAMP_DUTY;
                const dup = !it.unnamed && items.filter((x) => !x.unnamed && productKey(x.name) === productKey(it.name)).length > 1;
                const notes = [
                  stamp ? 'taxe, gardée sur la course' : null,
                  it.scanned && !it.unnamed && !stamp ? 'lu sur le ticket' : null,
                  it.otherUnit ? `au ${it.unit}, noté à part` : null,
                  v === null && !(it.known || it.scanned || stamp) ? 'nouveau produit' : null,
                ].filter(Boolean);
                return (
                  <Pop key={it.id}>
                    <View style={st.line}>
                      {k > 0 ? <View style={st.hair} /> : null}
                      <View style={st.lineTop}>
                        <Tile text={it.name} />
                        <View style={ui.flex}>
                          <Text style={t.name}>{it.name}</Text>
                          <Text style={t.meta}>{qtyLabel(it.qty, it.unit)} × {money(it.unitPrice)} DH{perUnit(it.unit)}{notes.length ? ` · ${notes.join(' · ')}` : ''}</Text>
                        </View>
                        <View style={st.lineEnd}>
                          <Text style={t.price}>{money(it.qty * it.unitPrice)}</Text>
                          {v ? <VerdictChip v={v} /> : null}
                        </View>
                      </View>
                      {dup || it.unnamed ? (
                        <View style={st.wrap}>
                          {dup ? <CheckChip label="Doublon ?" /> : null}
                          {it.unnamed ? <CheckChip label="Nom à écrire" /> : null}
                        </View>
                      ) : null}
                      {it.suggest ? (
                        <View style={st.same}>
                          <Icon name="link" size={size.iconDense} color={colors.onPrimaryContainer} />
                          <Text style={st.sameText} numberOfLines={2}>Même produit que <Text style={st.sameName}>{it.suggest.name}</Text> ?</Text>
                          <Button compact kind="primary" label="Oui" onPress={() => acceptSuggest(it)} />
                          <Button compact kind="quiet" label="Non" onPress={() => update(it.id, { suggest: undefined })} />
                        </View>
                      ) : null}
                      {stamp ? null : (
                        <View style={st.lineActions}>
                          <View style={st.stepper}>
                            <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${fmtQty(stepFor(it.unit))} ${it.unit}`} onPress={() => changeQty(it.id, -1)} style={st.step}><Icon name="minus" size={size.iconDense} /></Pressable>
                            <Text style={st.stepValue}>{qtyLabel(it.qty, it.unit)}</Text>
                            <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter ${fmtQty(stepFor(it.unit))} ${it.unit}`} onPress={() => changeQty(it.id, 1)} style={st.step}><Icon name="plus" size={size.iconDense} /></Pressable>
                          </View>
                          <Pill label="Promo" icon="promo" active={!!it.promo} onPress={() => update(it.id, { promo: !it.promo })} />
                          <View style={ui.flex} />
                          <IconButton icon="edit" label={`Modifier ${it.name}`} onPress={() => editLine(it)} />
                          <IconButton icon="delete" label={`Supprimer ${it.name}`} tone="danger" onPress={() => removeLine(it.id)} />
                        </View>
                      )}
                    </View>
                  </Pop>
                );
              })}
            </Group>
          )}
        </ScrollView>

        <View style={st.footer}>
          <View style={st.totalRow}>
            <Text style={t.meta}>{cleanName(store) ? `Total chez ${cleanName(store)}` : 'Total'}</Text>
            <Text style={st.total}>{money(total)}<Text style={t.unit}>{' '}DH</Text></Text>
          </View>
          <Button label={saving ? 'Enregistrement…' : editId ? 'Enregistrer les changements' : 'Enregistrer la course'} icon="check" onPress={save} disabled={saving || scanning} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = sheet(() => ({
  content: { paddingHorizontal: size.screen, paddingBottom: space.section, gap: space.md },
  headActions: { flexDirection: 'row', gap: space.sm },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.row, paddingHorizontal: space.lg, ...bubble('lg'), backgroundColor: colors.surfaceContainer },
  setup: { gap: space.md, paddingBottom: space.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dateBox: { flex: 1, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  scanCard: { backgroundColor: colors.primaryContainer, ...bubble('lg'), padding: space.lg, gap: space.sm },
  scanHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  scanText: { flex: 1, ...text('title'), color: colors.onPrimaryContainer },
  fallback: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  failCard: { ...bubble('lg'), padding: space.lg, gap: space.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: pc.warnBorder },
  failHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  failActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  form: { gap: space.md, backgroundColor: colors.surfaceLow, borderRadius: radius.card, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.primaryContainer, maxWidth: '100%' },
  suggestText: { ...text('labelSm'), color: colors.onPrimaryContainer, flexShrink: 1 },
  suggestPrice: { ...text('priceDelta'), color: colors.onPrimaryContainer },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  numbers: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  qtyBox: { width: 84 },
  num: { ...text('priceRow'), fontSize: 20, lineHeight: 28 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  error: { ...text('bodySm'), fontFamily: text('label').fontFamily, color: colors.error },
  basketHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: space.lg, paddingHorizontal: space.xs },
  basketTitle: { ...text('headlineSm'), color: colors.ink },
  line: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  hair: { position: 'absolute', top: 0, left: space.lg, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  lineTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lineEnd: { alignItems: 'flex-end', gap: space.xs },
  same: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.primaryContainer, ...bubble('sm'), paddingLeft: space.md, paddingRight: space.xs, paddingVertical: space.xs },
  sameText: { flex: 1, ...text('bodySm'), color: colors.onPrimaryContainer },
  sameName: { fontFamily: text('title').fontFamily },
  lineActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: size.lead + space.md },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.pill },
  step: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepValue: { ...text('priceDelta'), color: colors.ink, minWidth: 44, textAlign: 'center' },
  footer: { paddingHorizontal: size.screen, paddingTop: space.md, paddingBottom: space.md, gap: space.sm, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, ...floatShadow('sheet') },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  total: { ...text('headlineSm'), fontFamily: text('display').fontFamily, color: colors.ink, fontVariant: ['tabular-nums'] },
}));
