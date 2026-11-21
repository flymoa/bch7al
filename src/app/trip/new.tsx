import { Icon } from '@/components/icon';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/alert';
import type { ScrollViewInstance, TextInputInstance } from 'react-native';
import { Pop } from '@/components/motion';
import { showToast } from '@/components/toast';
import { scanAvailable, scanReceipt } from '@/scan';
import { STAMP_DUTY } from '@/receipt';
import { productIcon } from '@/icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Chip, Empty, Header, IconButton, LEAD, ListGroup, Pill, Screen, s as ui, t, VerdictBadge, VerdictStrip } from '@/components/ui';
import { getPref, setPref, getTrip, listProducts, listStores, saveTrip, type ProductRow } from '@/db';
import { addDays, cleanName, longDate, money, parseNumber, plural, productKey, verdict, qty as fmtQty, qtyLabel, todayIso } from '@/format';
import { bubble, colors, DEFAULT_STORES, fonts, UNITS, sheet, useTheme } from '@/theme';
import { radius, space, tabular, type } from '@/tokens';

/** `last` is the usual price of the product (average of earlier purchases), or null when there is nothing to compare. */
type BasketItem = { id: number; name: string; unit: string; qty: number; unitPrice: number; last: number | null; known: boolean; scanned?: boolean; unnamed?: boolean; otherUnit?: boolean };
type NewLine = Omit<BasketItem, 'id'>;
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
  const [items, setItems] = useState<BasketItem[]>([]);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<string>(UNITS[0]);
  /** The unit was picked by hand: it wins over the unit already known for the product. */
  const [unitPicked, setUnitPicked] = useState(false);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  /** For kg / L: was the weight typed in grams (mL)? */
  const [small, setSmall] = useState(false);
  /** For kg / L: did the user type the price per kg, or the total they paid? */
  const [priceMode, setPriceMode] = useState<'unit' | 'total'>('unit');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const [scanRows, setScanRows] = useState<string[]>([]);
  const [visionOn, setVisionOn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  /** Store + date picker, folded into one summary line once a store is known. */
  const [setupOpen, setSetupOpen] = useState(false);
  const nameRef = useRef<TextInputInstance>(null);
  useEffect(() => {
    getPref(db, 'geminiKey').then((k) => setVisionOn(!!k));
  }, [db]);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const formY = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [known, used, existing] = await Promise.all([
        listProducts(db, '', 'frequent'),
        listStores(db),
        editId ? getTrip(db, editId) : Promise.resolve(null),
      ]);
      if (!alive) return;
      setProducts(known);
      setLoaded(true);
      const keys = new Set(used.map(productKey));
      setStores([...used, ...DEFAULT_STORES.filter((d) => !keys.has(productKey(d)))]);
      if (!existing) {
        const last = await getPref(db, 'lastStore');
        if (!alive) return;
        const def = last || used[0] || '';
        if (def) setStore((cur) => cur || def);
        else setSetupOpen(true);
      }
      if (existing) {
        setStore(existing.trip.store);
        setDate(existing.trip.date);
        // When editing, the comparison with "last time" would include this very trip, so it is not shown.
        setItems(existing.items.map((it) => ({ id: nextLineId++, name: it.name, unit: it.unit, qty: it.qty, unitPrice: it.unit_price, last: null, known: true })));
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, editId]);

  const byKey = useMemo(() => new Map(products.map((p) => [productKey(p.name), p])), [products]);
  const typedKey = productKey(name);
  const match = byKey.get(typedKey);
  // A product keeps one unit for its whole history, otherwise prices could not be compared.
  // It can still be changed by hand (pièce, kg, paquet…); a different unit is noted apart.
  const shownUnit = match && !unitPicked ? match.unit : unit;
  const sameUnit = !match || match.unit === shownUnit;
  const measured = isMeasured(shownUnit);

  // Turns what was typed into a quantity in kg / L / pieces and a price for one unit.
  const computed = (() => {
    const p = parseNumber(price);
    const typed = parseNumber(quantity);
    if (!(p >= 0) || !(typed > 0)) return null;
    const q = measured && small ? typed / 1000 : typed;
    const unitPrice = measured && priceMode === 'total' ? p / q : p;
    return { qty: Math.round(q * 1000) / 1000, unitPrice: Math.round(unitPrice * 10000) / 10000, paid: q * unitPrice };
  })();

  // While typing the price of a product already bought: is it a good price?
  const hint = !editId && match && sameUnit && computed && price.trim() && match.name !== STAMP_DUTY ? verdict(computed.unitPrice, match.avg_price) : null;

  const basketKeys = new Set(items.map((it) => productKey(it.name)));
  const suggestions = products
    .filter((p) => !basketKeys.has(productKey(p.name)) && p.last_price !== null)
    .filter((p) => typedKey.length >= 2 && productKey(p.name).includes(typedKey) && !/timbre/i.test(p.name))
    .slice(0, 6);

  /** Adds a line. Typed items merge with the same product; scanned ones stay separate so duplicates can be spotted. */
  const upsert = (line: NewLine, merge = true) => {
    const item: BasketItem = { ...line, id: nextLineId++ };
    const key = productKey(item.name);
    setItems((cur) => {
      const i = merge ? cur.findIndex((x) => productKey(x.name) === key) : -1;
      if (i < 0) return [...cur, item];
      const copy = [...cur];
      copy[i] = { ...copy[i], unitPrice: item.unitPrice, qty: copy[i].qty + item.qty };
      return copy;
    });
  };

  const addTyped = () => {
    const clean = cleanName(name);
    if (!productKey(clean)) return setError("Écris le nom de l'article.");
    if (!computed) return setError(measured ? 'Écris le poids et le prix, par exemple 750 g et 6,50.' : 'Écris le prix, par exemple 12,50, et une quantité plus grande que zéro.');
    upsert({ name: match ? match.name : clean, unit: shownUnit, qty: computed.qty, unitPrice: computed.unitPrice, last: editId || !sameUnit ? null : match?.avg_price ?? null, known: !!match });
    setName('');
    setPrice('');
    setQuantity('1');
    setSmall(false);
    setPriceMode('unit');
    setUnit(UNITS[0]);
    setUnitPicked(false);
    setError('');
    nameRef.current?.focus();
  };

  const addSuggestion = (p: ProductRow) => {
    upsert({ name: p.name, unit: p.unit, qty: 1, unitPrice: p.last_price ?? 0, last: editId ? null : p.avg_price, known: true });
    setName('');
    setError('');
    nameRef.current?.focus();
  };

  const changeQty = (index: number, direction: 1 | -1) => {
    setItems((cur) => {
      const it = cur[index];
      const next = Math.round((it.qty + direction * stepFor(it.unit)) * 1000) / 1000;
      if (next <= 0) return cur.filter((_, i) => i !== index);
      return cur.map((x, i) => (i === index ? { ...x, qty: next } : x));
    });
  };

  const removeLine = (index: number) => {
    setItems((cur) => cur.filter((_, i) => i !== index));
  };

  /** Moves a basket line back into the form so its price or quantity can be corrected. */
  const editLine = (index: number) => {
    const it = items[index];
    scrollRef.current?.scrollTo({ y: Math.max(0, formY.current - space.md), animated: true });
    nameRef.current?.focus();
    setName(it.unnamed ? '' : it.name);
    setUnit(it.unit);
    setUnitPicked(true);
    setPriceMode('unit');
    setPrice(String(Math.round(it.unitPrice * 100) / 100).replace('.', ','));
    if (isMeasured(it.unit) && it.qty < 1) {
      setSmall(true);
      setQuantity(String(Math.round(it.qty * 1000)));
    } else {
      setSmall(false);
      setQuantity(fmtQty(it.qty));
    }
    setItems((cur) => cur.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);

  const scan = async (source: 'camera' | 'gallery' | 'photo') => {
    setError('');
    setScanning(true);
    try {
      const key = await getPref(db, 'geminiKey');
      const model = await getPref(db, 'geminiModel');
      const res = await scanReceipt(source, key, model);
      if (!res) return;
      if (res.model && res.model !== model) await setPref(db, 'geminiModel', res.model);
      setScanRows(res.rows);
      if (res.items.length === 0) {
        Alert.alert('Ticket illisible', "Aucun article n'a été reconnu. Reprends la photo bien à plat, avec de la lumière, ou saisis les articles à la main.");
        return;
      }
      if (res.store) {
        const known = stores.find((s2) => productKey(s2) === productKey(res.store!));
        setOtherStore(!known);
        setStore(known ?? res.store);
      }
      if (res.date && res.date <= todayIso()) setDate(res.date);
      for (const it of res.items) {
        let existing = it.unnamed ? undefined : byKey.get(productKey(it.name));
        let name = existing ? existing.name : it.name;
        // Same product but sold another way (kg vs piece): kept as its own product so the
        // per-kilo and per-piece prices never mix in one history.
        const otherUnit = !!existing && existing.unit !== it.unit;
        if (otherUnit) {
          name = `${existing!.name} (${it.unit === 'kg' ? 'kg' : it.unit})`;
          existing = byKey.get(productKey(name));
        }
        upsert({
          name,
          otherUnit,
          unit: existing ? existing.unit : it.unit,
          qty: it.qty,
          unitPrice: it.unitPrice,
          last: editId ? null : existing?.avg_price ?? null,
          known: !!existing,
          scanned: true,
          unnamed: it.unnamed,
        }, false);
      }
      const read = res.items.reduce((a, it) => a + it.qty * it.unitPrice, 0);
      const gap = res.total !== null ? Math.abs(res.total - read) : 0;
      const articles = res.items.filter((i) => i.name !== STAMP_DUTY).length;
      const unnamedCount = res.items.filter((i) => i.unnamed).length;
      // Receipts count units: "2 x 2.50" is 2 articles; a weighed item is 1.
      const units = res.items.filter((i) => i.name !== STAMP_DUTY).reduce((n, i) => n + (i.unit === 'pièce' && Number.isInteger(i.qty) ? i.qty : 1), 0);
      const missing = res.expected !== null && res.expected > units;
      const prefix = (res.warning ? res.warning + ' ' : '') + (res.engine === 'gemini' ? 'Lu avec Gemini. ' : '');
      setScanNote(prefix + (
        missing
          ? `Le ticket compte ${plural(res.expected!, 'article', 'articles')}, ${units} ${units > 1 ? 'ont été lus' : 'a été lu'}. Ajoute ceux qui manquent à la main, ou reprends la photo bien à plat et éclairée.`
          : unnamedCount > 0
          ? `${plural(articles, 'article lu', 'articles lus')}. Certains noms n'ont pas pu être lus : touche « Modifier » sur chaque ligne « Nom à écrire ». Les prix et quantités sont déjà remplis.`
          : res.total !== null && gap > 0.5
          ? `${plural(articles, 'article lu', 'articles lus')}. Le ticket dit ${money(res.total)} DH mais les articles font ${money(read)} DH : vérifie s'il en manque.`
          : `${plural(articles, 'article lu', 'articles lus')}${articles < res.items.length ? ' + droit de timbre' : ''}. Vérifie les noms et les prix avant d'enregistrer.`
      ));
    } catch (e) {
      Alert.alert('Le scan a échoué', String((e as Error).message ?? e));
    } finally {
      setScanning(false);
    }
  };
  const today = todayIso();

  // Opened from the home screen's "Scanner" button: go straight to the camera.
  const autoScan = useRef(false);
  useEffect(() => {
    if (!loaded || autoScan.current || editId || (params.scan !== 'camera' && params.scan !== 'gallery' && params.scan !== 'photo')) return;
    autoScan.current = true;
    scan(params.scan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const basketVerdicts = items.map((it) => (it.name === STAMP_DUTY ? null : verdict(it.unitPrice, it.last)));

  const save = async () => {
    if (!cleanName(store)) return setError('Choisis le magasin.');
    if (items.length === 0) return setError('Ajoute au moins un article.');
    if (items.some((it) => it.unnamed)) return setError('Écris le nom des articles marqués « Nom à écrire » (bouton Modifier).');
    if (productKey(name) || price.trim()) {
      return setError("Un article est en cours de saisie. Touche + pour l'ajouter, ou efface-le.");
    }
    setSaving(true);
    try {
      await setPref(db, 'lastStore', cleanName(store));
      await saveTrip(db, { id: editId, store, date, items: items.map(({ name: n, unit: u, qty: q, unitPrice }) => ({ name: n, unit: u, qty: q, unitPrice })) });
      showToast(editId ? 'Course modifiée' : `Bsse7a ! Course enregistrée · ${money(total)} DH`);
      if (router.canGoBack()) router.back();
      else router.replace('/trips');
    } catch (e) {
      setSaving(false);
      Alert.alert("L'enregistrement a échoué", String((e as Error).message ?? e));
    }
  };

  return (
    <Screen>
      <Header
        title={editId ? 'Modifier la course' : 'Nouvelle course'}
        right={
          editId ? undefined : (
            <View style={st.headActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Scanner le ticket avec l'appareil photo" disabled={scanning} onPress={() => scan('camera')} style={({ pressed }) => [ui.round, pressed && ui.pressed, scanning && ui.disabled]}>
                <Icon name="camera-outline" size={22} color={colors.blue} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Scanner un ticket depuis la galerie" disabled={scanning} onPress={() => scan('gallery')} style={({ pressed }) => [ui.round, pressed && ui.pressed, scanning && ui.disabled]}>
                <Icon name="images-outline" size={22} color={colors.blue} />
              </Pressable>
            </View>
          )
        }
      />
      <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Changer le magasin ou la date"
            accessibilityState={{ expanded: setupOpen }}
            onPress={() => setSetupOpen((o) => !o)}
            style={({ pressed }) => [st.summary, pressed && ui.pressed]}
          >
            <Text style={st.summaryText} numberOfLines={1}>
              {cleanName(store) || 'Choisis le magasin'}
              <Text style={st.summaryDate}> · {date === today ? "aujourd'hui" : longDate(date)}</Text>
            </Text>
            <Icon name={setupOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
          </Pressable>

          {setupOpen ? (
            <View style={st.setup}>
              <View style={st.dateRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Jour précédent" onPress={() => setDate(addDays(date, -1))} style={ui.round}>
                  <Icon name="chevron-back" size={22} color={colors.ink} />
                </Pressable>
                <View style={st.dateBox}>
                  <Text style={st.dateText}>{date === today ? "Aujourd'hui" : longDate(date)}</Text>
                  {date === today ? <Text style={t.meta}>{longDate(date)}</Text> : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Jour suivant"
                  accessibilityState={{ disabled: date >= today }}
                  disabled={date >= today}
                  onPress={() => setDate(addDays(date, 1))}
                  style={[ui.round, date >= today && ui.disabled]}
                >
                  <Icon name="chevron-forward" size={22} color={colors.ink} />
                </Pressable>
              </View>
              <Text style={st.label}>Où as-tu fait tes courses ?</Text>
              <View style={st.wrap}>
                {stores.map((name_) => (
                  <Pill
                    key={name_}
                    label={name_}
                    active={!otherStore && productKey(store) === productKey(name_)}
                    onPress={() => {
                      setOtherStore(false);
                      setStore(name_);
                      setError('');
                      setSetupOpen(false);
                    }}
                  />
                ))}
                <Pill
                  label="Autre"
                  active={otherStore}
                  onPress={() => {
                    setOtherStore(true);
                    setStore('');
                  }}
                />
              </View>
              {otherStore ? (
                <TextInput
                  accessibilityLabel="Nom du magasin"
                  value={store}
                  onChangeText={setStore}
                  placeholder="Nom du magasin"
                  placeholderTextColor={colors.muted}
                  style={[st.input, st.gapTop]}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => setSetupOpen(false)}
                />
              ) : null}
              {editId ? null : (
                <Text style={[t.meta, st.gapTop]}>
                  {scanAvailable ? (visionOn ? 'Scan du ticket : lecture Gemini, français et arabe.' : "Scan du ticket : lecture sur le téléphone. Pour l'arabe : Réglages.") : 'Aperçu : Photo = ticket Marjane, Galerie = ticket en arabe.'}
                </Text>
              )}
            </View>
          ) : null}

          {scanning ? <Text style={st.scanNote}>Lecture du ticket…</Text> : null}
          {scanNote ? <Text style={[st.scanNote, st.gapTop]}>{scanNote}</Text> : null}
          {scanRows.length ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => Alert.alert('Texte lu sur le ticket', scanRows.join('\n'))}
              style={({ pressed }) => [st.rawBtn, pressed && ui.pressed]}
            >
              <Icon name="document-text-outline" size={18} color={colors.blue} />
              <Text style={st.rawBtnText}>Voir le texte lu</Text>
            </Pressable>
          ) : null}

          <View onLayout={(e) => { formY.current = e.nativeEvent.layout.y; }}>
          <Card style={st.form}>
            <Text style={st.label}>Article</Text>
            <TextInput
              ref={nameRef}
              autoFocus={!editId && !params.scan}
              accessibilityLabel="Nom de l'article"
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError('');
              }}
              placeholder="Ex. Farine 5kg"
              placeholderTextColor={colors.muted}
              style={st.input}
              autoCapitalize="sentences"
              returnKeyType="next"
            />
            {suggestions.length > 0 ? (
              <View style={st.suggest}>
                <Text style={t.label}>Déjà acheté, touche pour ajouter</Text>
                <View style={st.wrap}>
                  {suggestions.map((p) => (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Ajouter ${p.name} à ${money(p.last_price ?? 0)} dirhams`}
                      onPress={() => addSuggestion(p)}
                      style={({ pressed }) => [st.suggestChip, pressed && ui.pressed]}
                    >
                      <Text style={st.suggestText}>
                        {p.name} · {money(p.last_price ?? 0)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Text style={[st.label, st.gapTop]}>{match && !sameUnit ? `Vendu par (avant : ${match.unit})` : 'Vendu par'}</Text>
            <View style={st.wrap}>
              {UNITS.map((u) => (
                <Pill key={u} label={u} active={shownUnit === u} onPress={() => { setUnit(u); setUnitPicked(true); setError(''); }} />
              ))}
            </View>

            {measured ? (
              <>
                <Text style={[st.label, st.gapTop]}>{shownUnit === 'kg' ? 'Poids acheté' : 'Volume acheté'}</Text>
                <View style={st.weightRow}>
                  <TextInput
                    accessibilityLabel={`Quantité en ${small ? smallUnit(shownUnit) : shownUnit}`}
                    value={quantity}
                    onChangeText={(v) => {
                      setQuantity(v);
                      setError('');
                    }}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    style={[st.input, st.number, ui.flex]}
                  />
                  <Pill label={smallUnit(shownUnit)} active={small} onPress={() => setSmall(true)} />
                  <Pill label={shownUnit} active={!small} onPress={() => setSmall(false)} />
                </View>
                <Text style={[st.label, st.gapTop]}>J'ai noté</Text>
                <View style={st.wrap}>
                  <Pill label={`Le prix du ${shownUnit === 'kg' ? 'kilo' : 'litre'}`} active={priceMode === 'unit'} onPress={() => setPriceMode('unit')} />
                  <Pill label="Ce que j'ai payé" active={priceMode === 'total'} onPress={() => setPriceMode('total')} />
                </View>
              </>
            ) : null}

            <View style={st.numbers}>
              <View style={ui.flex}>
                <Text style={st.label}>{measured && priceMode === 'total' ? 'Prix payé (DH)' : `Prix pour 1 ${shownUnit}`}</Text>
                <TextInput
                  accessibilityLabel={measured && priceMode === 'total' ? 'Prix payé en dirhams' : `Prix en dirhams pour 1 ${shownUnit}`}
                  value={price}
                  onChangeText={(v) => {
                    setPrice(v);
                    setError('');
                  }}
                  placeholder="0,00"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  style={[st.input, st.number]}
                />
              </View>
              {measured ? null : (
                <View style={st.qtyBox}>
                  <Text style={st.label}>Quantité</Text>
                  <TextInput
                    accessibilityLabel="Quantité"
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    style={[st.input, st.number]}
                  />
                </View>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel="Ajouter l'article au panier" onPress={addTyped} style={({ pressed }) => [st.add, pressed && ui.pressed]}>
                <Icon name="add" size={28} color={colors.white} />
              </Pressable>
            </View>
            {hint ? (
              <View style={[st.hint, { backgroundColor: hint.kind === 'high' ? colors.upBg : colors.soft }, hint.kind === 'high' && ui.upBox]} accessibilityLiveRegion="polite">
                <Icon name={hint.kind === 'good' ? 'thumbs-up' : hint.kind === 'high' ? 'alert-circle' : 'checkmark-circle'} size={18} color={hint.kind === 'high' ? colors.upText : colors.softText} />
                <Text style={[st.hintText, { color: hint.kind === 'high' ? colors.upText : colors.softText }]}>
                  {hint.kind === 'good' ? 'Mzyan' : hint.kind === 'high' ? 'Ghali' : 'Prix habituel'} : d'habitude {money(match?.avg_price ?? 0)} DH{shownUnit === 'pièce' ? '' : ` / ${shownUnit}`}
                </Text>
              </View>
            ) : null}
            {measured && computed && price.trim() ? (
              <Text style={st.calc} accessibilityLiveRegion="polite">
                {qtyLabel(computed.qty, shownUnit)} ·{' '}
                {priceMode === 'total'
                  ? `soit ${money(computed.unitPrice)} DH le ${shownUnit === 'kg' ? 'kilo' : 'litre'}`
                  : `tu paies ${money(computed.paid)} DH`}
              </Text>
            ) : null}
          </Card>
          </View>

          {error ? (
            <Text style={st.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <View style={st.basketHead}>
            <Text style={st.basketTitle}>Dans mon panier</Text>
            <Text style={t.label}>{plural(items.length, 'article', 'articles')}</Text>
          </View>
          {basketVerdicts.some(Boolean) ? (
            <View style={st.stripCard}>
              <Text style={st.stripTitle}>Comparé à tes prix habituels</Text>
              <VerdictStrip verdicts={basketVerdicts} onNight />
            </View>
          ) : null}
          {items.length === 0 ? (
            <Empty title="Ton panier est vide" text="Ajoute ton premier article juste au-dessus." />
          ) : (
            <ListGroup>
              {items.map((it, i) => ({ it, i })).reverse().map(({ it, i }, k) => {
                const v = it.name === STAMP_DUTY ? null : verdict(it.unitPrice, it.last);
                const dup = !it.unnamed && items.filter((x) => !x.unnamed && productKey(x.name) === productKey(it.name)).length > 1;
                const notes = [
                  it.scanned && !it.unnamed ? 'lu sur le ticket' : null,
                  it.otherUnit ? `au ${it.unit}, noté à part` : null,
                  v === null && !(it.known || it.scanned || it.name === STAMP_DUTY) ? 'nouveau produit' : null,
                  v && v.kind !== 'normal' ? `${money(Math.abs(it.unitPrice - (it.last ?? 0)))} DH ${v.change < 0 ? 'de moins' : 'de plus'}` : null,
                ].filter(Boolean);
                return (
                  <Pop key={it.id}>
                    <View style={[st.line, (dup || it.unnamed) && st.lineDup]}>
                      {k > 0 ? <View style={st.divider} /> : null}
                      <View style={st.lineTop}>
                        <View style={st.lineIcon}>
                          <MaterialCommunityIcons name={productIcon(it.name) as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={colors.softText} />
                        </View>
                        <View style={st.lineMain}>
                          <Text style={t.name}>{it.name}</Text>
                          <Text style={t.meta}>
                            {qtyLabel(it.qty, it.unit)} × {money(it.unitPrice)} DH{it.unit === 'pièce' ? '' : ` / ${it.unit}`}
                            {notes.length ? ` · ${notes.join(' · ')}` : ''}
                          </Text>
                          {dup || it.unnamed ? (
                            <View style={st.chips}>
                              {dup ? <Chip label="Doublon ?" tone="up" icon="copy-outline" /> : null}
                              {it.unnamed ? <Chip label="Nom à écrire" tone="up" icon="create-outline" /> : null}
                            </View>
                          ) : null}
                        </View>
                        <View style={st.lineRight}>
                          <Text style={st.lineTotal}>{money(it.qty * it.unitPrice)}</Text>
                          {v ? <VerdictBadge v={v} /> : null}
                        </View>
                      </View>
                      <View style={st.lineActions}>
                        <View style={st.stepper}>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${fmtQty(stepFor(it.unit))} ${it.unit} de ${it.name}`} onPress={() => changeQty(i, -1)} style={st.step}>
                            <Icon name="remove" size={20} color={colors.ink} />
                          </Pressable>
                          <Text style={st.stepValue}>{qtyLabel(it.qty, it.unit)}</Text>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter ${fmtQty(stepFor(it.unit))} ${it.unit} à ${it.name}`} onPress={() => changeQty(i, 1)} style={st.step}>
                            <Icon name="add" size={20} color={colors.ink} />
                          </Pressable>
                        </View>
                        <View style={st.lineButtons}>
                          <IconButton icon="create-outline" label={`Modifier ${it.name}`} onPress={() => editLine(i)} />
                          <IconButton icon="trash-outline" label={`Supprimer ${it.name}`} onPress={() => removeLine(i)} tone="danger" />
                        </View>
                      </View>
                    </View>
                  </Pop>
                );
              })}
            </ListGroup>
          )}
        </ScrollView>

        <View style={st.footer}>
          <View style={st.totalRow}>
            <Text style={st.totalLabel}>{cleanName(store) ? `Total chez ${cleanName(store)}` : 'Total'}</Text>
            <Text style={st.total}>
              {money(total)} <Text style={t.unit}>DH</Text>
            </Text>
          </View>
          <Button label={saving ? 'Enregistrement…' : editId ? 'Enregistrer les changements' : 'Enregistrer la course'} onPress={save} disabled={saving} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = sheet(() => ({
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, marginTop: space.md },
  hintText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: type.body },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  stripCard: { backgroundColor: colors.night, ...bubble(radius.lg), padding: space.lg, gap: space.md, marginBottom: space.md },
  stripTitle: { fontFamily: fonts.title, fontSize: type.body, color: colors.white },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  dateBox: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  dateText: { fontFamily: fonts.title, fontSize: type.bodyLg, color: colors.ink },
  label: { fontFamily: fonts.bodyBold, fontSize: type.caption, color: colors.muted, marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  gapTop: { marginTop: space.md },
  form: { marginTop: space.sm, padding: space.lg },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, paddingHorizontal: space.md, backgroundColor: colors.card, fontFamily: fonts.body, fontSize: type.bodyLg, color: colors.ink },
  number: { fontFamily: fonts.title, fontSize: type.title, ...tabular },
  suggest: { marginTop: space.md, gap: space.sm },
  suggestChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.soft },
  suggestText: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.softText, ...tabular },
  numbers: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.md },
  qtyBox: { width: 88 },
  headActions: { flexDirection: 'row', gap: space.sm },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.xs },
  summaryText: { flex: 1, fontFamily: fonts.title, fontSize: type.bodyLg, color: colors.ink },
  summaryDate: { fontFamily: fonts.body, color: colors.muted },
  setup: { paddingTop: space.sm, paddingBottom: space.md },
  rawBtn: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, alignSelf: 'flex-start', paddingHorizontal: space.xs },
  rawBtnText: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.blue },
  scanNote: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.softText, backgroundColor: colors.soft, borderRadius: radius.sm, padding: space.md, overflow: 'hidden' },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  calc: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.softText, backgroundColor: colors.soft, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm, marginTop: space.md, overflow: 'hidden', ...tabular },
  add: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.danger, marginTop: space.md, paddingHorizontal: space.xs },
  basketHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xs, paddingTop: space.xl, paddingBottom: space.sm },
  basketTitle: { fontFamily: fonts.title, fontSize: type.title, color: colors.ink },
  lineIcon: { width: LEAD, height: LEAD, borderRadius: radius.sm, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  lineDup: { borderWidth: 2, borderColor: colors.upText, borderRadius: radius.lg },
  divider: { position: 'absolute', top: 0, right: 0, left: space.lg + LEAD + space.md, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  lineRight: { alignItems: 'flex-end', gap: space.xs },
  lineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  lineActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm, marginLeft: LEAD + space.md },
  lineButtons: { flexDirection: 'row' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  line: { paddingVertical: space.md, paddingHorizontal: space.lg },
  lineMain: { flex: 1, minWidth: 0, gap: space.xs, minHeight: 44, justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  step: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.neutral, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontFamily: fonts.title, fontSize: type.body, color: colors.ink, minWidth: 32, textAlign: 'center', ...tabular },
  lineTotal: { fontFamily: fonts.titleBold, fontSize: type.title, color: colors.ink, minWidth: 64, textAlign: 'right', ...tabular },
  footer: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.lg, gap: space.md, elevation: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.muted, flex: 1 },
  total: { fontFamily: fonts.titleBold, fontSize: type.price, color: colors.ink, ...tabular },
}));
