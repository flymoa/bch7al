import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/alert';
import type { ScrollViewInstance } from 'react-native';
import { Pop } from '@/components/motion';
import { showToast } from '@/components/toast';
import { scanAvailable, scanReceipt } from '@/scan';
import { productIcon } from '@/icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Chip, Empty, Header, Pill, Screen, s as ui, t } from '@/components/ui';
import { getTrip, listProducts, listStores, saveTrip, type ProductRow } from '@/db';
import { addDays, cleanName, longDate, money, parseNumber, plural, productKey, qty as fmtQty, qtyLabel, todayIso } from '@/format';
import { colors, DEFAULT_STORES, fonts, UNITS, sheet, useTheme } from '@/theme';

type BasketItem = { id: number; name: string; unit: string; qty: number; unitPrice: number; last: number | null; known: boolean; scanned?: boolean };
type NewLine = Omit<BasketItem, 'id'>;
let nextLineId = 1;

const isMeasured = (unit: string) => unit === 'kg' || unit === 'L';
const stepFor = (unit: string) => (isMeasured(unit) ? 0.25 : 1);
const smallUnit = (unit: string) => (unit === 'L' ? 'mL' : 'g');

export default function TripForm() {
  useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;

  const [stores, setStores] = useState<string[]>(DEFAULT_STORES);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [store, setStore] = useState('');
  const [otherStore, setOtherStore] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [items, setItems] = useState<BasketItem[]>([]);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<string>(UNITS[0]);
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
      const keys = new Set(used.map(productKey));
      setStores([...used, ...DEFAULT_STORES.filter((d) => !keys.has(productKey(d)))]);
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
  const shownUnit = match ? match.unit : unit;
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

  const basketKeys = new Set(items.map((it) => productKey(it.name)));
  const suggestions = products
    .filter((p) => !basketKeys.has(productKey(p.name)) && p.last_price !== null)
    .filter((p) => (typedKey ? productKey(p.name).includes(typedKey) : true))
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
    upsert({ name: match ? match.name : clean, unit: shownUnit, qty: computed.qty, unitPrice: computed.unitPrice, last: editId ? null : match?.last_price ?? null, known: !!match });
    setName('');
    setPrice('');
    setQuantity('1');
    setSmall(false);
    setPriceMode('unit');
    setUnit(UNITS[0]);
    setError('');
  };

  const addSuggestion = (p: ProductRow) => {
    upsert({ name: p.name, unit: p.unit, qty: 1, unitPrice: p.last_price ?? 0, last: editId ? null : p.last_price, known: true });
    setName('');
    setError('');
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
    scrollRef.current?.scrollTo({ y: Math.max(0, formY.current - 12), animated: true });
    setName(it.name);
    setUnit(it.unit);
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

  const scan = async (source: 'camera' | 'gallery') => {
    setError('');
    setScanning(true);
    try {
      const res = await scanReceipt(source);
      if (!res) return;
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
        const existing = byKey.get(productKey(it.name));
        upsert({
          name: existing ? existing.name : it.name,
          unit: existing ? existing.unit : it.unit,
          qty: it.qty,
          unitPrice: it.unitPrice,
          last: editId ? null : existing?.last_price ?? null,
          known: !!existing,
          scanned: true,
        }, false);
      }
      const read = res.items.reduce((a, it) => a + it.qty * it.unitPrice, 0);
      const gap = res.total !== null ? Math.abs(res.total - read) : 0;
      setScanNote(
        res.total !== null && gap > 0.5
          ? `${plural(res.items.length, 'article lu', 'articles lus')}. Le ticket dit ${money(res.total)} MAD mais les articles font ${money(read)} MAD : vérifie s'il en manque.`
          : `${plural(res.items.length, 'article lu', 'articles lus')}. Vérifie les noms et les prix avant d'enregistrer.`,
      );
    } catch (e) {
      Alert.alert('Le scan a échoué', String((e as Error).message ?? e));
    } finally {
      setScanning(false);
    }
  };
  const today = todayIso();

  const save = async () => {
    if (!cleanName(store)) return setError('Choisis le magasin.');
    if (items.length === 0) return setError('Ajoute au moins un article.');
    if (productKey(name) || price.trim()) {
      return setError("Un article est en cours de saisie. Touche + pour l'ajouter, ou efface-le.");
    }
    setSaving(true);
    try {
      await saveTrip(db, { id: editId, store, date, items: items.map(({ name: n, unit: u, qty: q, unitPrice }) => ({ name: n, unit: u, qty: q, unitPrice })) });
      showToast(editId ? 'Course modifiée' : `Course enregistrée · ${money(total)} MAD`);
      router.canGoBack() ? router.back() : router.replace('/trips');
    } catch (e) {
      setSaving(false);
      Alert.alert("L'enregistrement a échoué", String((e as Error).message ?? e));
    }
  };

  return (
    <Screen>
      <Header title={editId ? 'Modifier la course' : 'Nouvelle course'} />
      <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <View style={st.dateRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Jour précédent" onPress={() => setDate(addDays(date, -1))} style={ui.round}>
              <Ionicons name="chevron-back" size={22} color={colors.ink} />
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
              <Ionicons name="chevron-forward" size={22} color={colors.ink} />
            </Pressable>
          </View>

          {editId ? null : (
            <Card style={st.scanCard}>
              <View style={st.scanHead}>
                <View style={st.scanIcon}>
                  <Ionicons name="receipt-outline" size={24} color={colors.softText} />
                </View>
                <View style={ui.flex}>
                  <Text style={st.scanTitle}>Scanner le ticket</Text>
                  <Text style={t.meta}>{scanAvailable ? 'Les articles se remplissent tout seuls.' : "Aperçu : charge un ticket d'exemple."}</Text>
                </View>
              </View>
              <View style={st.scanButtons}>
                <Pressable accessibilityRole="button" disabled={scanning} onPress={() => scan('camera')} style={({ pressed }) => [st.scanBtn, pressed && ui.pressed, scanning && ui.disabled]}>
                  <Ionicons name="camera-outline" size={20} color={colors.white} />
                  <Text style={st.scanBtnText}>{scanning ? 'Lecture…' : 'Photo'}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={scanning} onPress={() => scan('gallery')} style={({ pressed }) => [st.scanBtn, st.scanBtnLight, pressed && ui.pressed, scanning && ui.disabled]}>
                  <Ionicons name="images-outline" size={20} color={colors.blue} />
                  <Text style={[st.scanBtnText, { color: colors.blue }]}>Galerie</Text>
                </Pressable>
              </View>
              {scanNote ? <Text style={st.scanNote}>{scanNote}</Text> : null}
            </Card>
          )}

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
            />
          ) : null}

          <View onLayout={(e) => { formY.current = e.nativeEvent.layout.y; }}>
          <Card style={st.form}>
            <Text style={st.label}>Article</Text>
            <TextInput
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
                <Text style={t.label}>{typedKey ? 'Déjà acheté, touche pour ajouter' : 'Tu achètes souvent, touche pour ajouter'}</Text>
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

            <Text style={[st.label, st.gapTop]}>{match ? `Vendu par (fixé pour ${match.name})` : 'Vendu par'}</Text>
            <View style={st.wrap}>
              {UNITS.map((u) => (
                <Pill key={u} label={u} active={shownUnit === u} disabled={!!match} onPress={() => setUnit(u)} />
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
                <Text style={st.label}>{measured && priceMode === 'total' ? 'Prix payé (MAD)' : `Prix pour 1 ${shownUnit}`}</Text>
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
                <Ionicons name="add" size={28} color={colors.white} />
              </Pressable>
            </View>
            {measured && computed && price.trim() ? (
              <Text style={st.calc} accessibilityLiveRegion="polite">
                {qtyLabel(computed.qty, shownUnit)} ·{' '}
                {priceMode === 'total'
                  ? `soit ${money(computed.unitPrice)} MAD le ${shownUnit === 'kg' ? 'kilo' : 'litre'}`
                  : `tu paies ${money(computed.paid)} MAD`}
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
          {items.length === 0 ? (
            <Empty title="Ton panier est vide" text="Ajoute ton premier article juste au-dessus." />
          ) : (
            <View style={st.basket}>
              {items.map((it, i) => {
                const diff = it.last === null ? null : Math.round((it.unitPrice - it.last) * 100) / 100;
                const dup = items.filter((x) => productKey(x.name) === productKey(it.name)).length > 1;
                return (
                  <Pop key={it.id}>
                    <Card style={[st.line, dup && st.lineDup]}>
                      <View style={st.lineTop}>
                        <View style={st.lineIcon}>
                          <MaterialCommunityIcons name={productIcon(it.name) as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={colors.softText} />
                        </View>
                        <View style={st.lineMain}>
                          <Text style={t.name}>{it.name}</Text>
                          <Text style={t.meta}>
                            {qtyLabel(it.qty, it.unit)} × {money(it.unitPrice)} MAD{it.unit === 'pièce' ? '' : ` / ${it.unit}`}
                          </Text>
                          <View style={st.chips}>
                            {dup ? <Chip label="Doublon ?" tone="up" icon="copy-outline" /> : null}
                            {it.scanned ? <Chip label="Lu sur le ticket" icon="receipt-outline" /> : null}
                            {diff === null ? (
                              it.known || it.scanned ? null : <Chip label="Nouveau produit" />
                            ) : diff === 0 ? (
                              <Chip label="Même prix" />
                            ) : (
                              <Chip label={`${diff > 0 ? '+' : '−'}${money(Math.abs(diff))} vs dernière fois`} tone={diff > 0 ? 'up' : 'down'} />
                            )}
                          </View>
                        </View>
                        <Text style={st.lineTotal}>{money(it.qty * it.unitPrice)}</Text>
                      </View>
                      <View style={st.lineActions}>
                        <View style={st.stepper}>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${fmtQty(stepFor(it.unit))} ${it.unit} de ${it.name}`} onPress={() => changeQty(i, -1)} style={st.step}>
                            <Ionicons name="remove" size={20} color={colors.ink} />
                          </Pressable>
                          <Text style={st.stepValue}>{qtyLabel(it.qty, it.unit)}</Text>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter ${fmtQty(stepFor(it.unit))} ${it.unit} à ${it.name}`} onPress={() => changeQty(i, 1)} style={st.step}>
                            <Ionicons name="add" size={20} color={colors.ink} />
                          </Pressable>
                        </View>
                        <View style={st.lineButtons}>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Modifier ${it.name}`} onPress={() => editLine(i)} style={({ pressed }) => [st.iconBtn, pressed && ui.pressed]}>
                            <Ionicons name="create-outline" size={20} color={colors.blue} />
                            <Text style={st.iconBtnText}>Modifier</Text>
                          </Pressable>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Supprimer ${it.name}`} onPress={() => removeLine(i)} style={({ pressed }) => [st.iconBtn, pressed && ui.pressed]}>
                            <Ionicons name="trash-outline" size={20} color={colors.danger} />
                          </Pressable>
                        </View>
                      </View>
                    </Card>
                  </Pop>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={st.footer}>
          <View style={st.totalRow}>
            <Text style={st.totalLabel}>{cleanName(store) ? `Total chez ${cleanName(store)}` : 'Total'}</Text>
            <Text style={st.total}>
              {money(total)} <Text style={t.unit}>MAD</Text>
            </Text>
          </View>
          <Button label={saving ? 'Enregistrement…' : editId ? 'Enregistrer les changements' : 'Enregistrer la course'} onPress={save} disabled={saving} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = sheet(() => ({
  content: { paddingHorizontal: 16, paddingBottom: 20 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  dateBox: { flex: 1, minHeight: 52, backgroundColor: colors.card, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  dateText: { fontFamily: fonts.title, fontSize: 17, color: colors.ink },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.muted, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gapTop: { marginTop: 12 },
  form: { marginTop: 16, padding: 14 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 12, backgroundColor: colors.card, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  number: { fontFamily: fonts.title, fontSize: 18 },
  suggest: { marginTop: 10, gap: 6 },
  suggestChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.soft },
  suggestText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.softText },
  numbers: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 },
  qtyBox: { width: 92 },
  scanCard: { marginBottom: 14, gap: 12, padding: 14 },
  scanHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scanIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  scanTitle: { fontFamily: fonts.title, fontSize: 17, color: colors.ink },
  scanButtons: { flexDirection: 'row', gap: 8 },
  scanBtn: { flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  scanBtnLight: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border },
  scanBtnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  scanNote: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.softText, backgroundColor: colors.soft, borderRadius: 12, padding: 10, overflow: 'hidden' },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calc: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.softText, backgroundColor: colors.soft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, overflow: 'hidden' },
  add: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.danger, marginTop: 10, paddingHorizontal: 4 },
  basketHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingTop: 18, paddingBottom: 8 },
  basketTitle: { fontFamily: fonts.title, fontSize: 18, color: colors.ink },
  basket: { gap: 8 },
  lineIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  lineDup: { borderWidth: 2, borderColor: colors.upText },
  lineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  lineActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  lineButtons: { flexDirection: 'row', gap: 6 },
  iconBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.neutral, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  iconBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.blue },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  line: { paddingVertical: 10, paddingHorizontal: 12 },
  lineMain: { flex: 1, minWidth: 0, gap: 3, minHeight: 44, justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  step: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.neutral, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontFamily: fonts.title, fontSize: 15, color: colors.ink, minWidth: 30, textAlign: 'center' },
  lineTotal: { fontFamily: fonts.title, fontSize: 17, color: colors.ink, minWidth: 64, textAlign: 'right' },
  footer: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, gap: 10, elevation: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.muted, flex: 1 },
  total: { fontFamily: fonts.title, fontSize: 28, color: colors.ink },
}));
