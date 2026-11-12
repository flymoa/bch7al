import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, Empty, Header, Pill, Screen, s as ui, t } from '@/components/ui';
import { getTrip, listProducts, listStores, saveTrip, type ProductRow } from '@/db';
import { addDays, cleanName, longDate, money, parseNumber, plural, productKey, qty as fmtQty, todayIso } from '@/format';
import { colors, DEFAULT_STORES, fonts, UNITS } from '@/theme';

type BasketItem = { name: string; unit: string; qty: number; unitPrice: number; last: number | null; known: boolean };

const stepFor = (unit: string) => (unit === 'kg' || unit === 'L' ? 0.5 : 1);

export default function TripForm() {
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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
        setItems(existing.items.map((it) => ({ name: it.name, unit: it.unit, qty: it.qty, unitPrice: it.unit_price, last: null, known: true })));
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

  const basketKeys = new Set(items.map((it) => productKey(it.name)));
  const suggestions = products
    .filter((p) => !basketKeys.has(productKey(p.name)) && p.last_price !== null)
    .filter((p) => (typedKey ? productKey(p.name).includes(typedKey) : true))
    .slice(0, 6);

  const upsert = (item: BasketItem) => {
    const key = productKey(item.name);
    setItems((cur) => {
      const i = cur.findIndex((x) => productKey(x.name) === key);
      if (i < 0) return [...cur, item];
      const copy = [...cur];
      copy[i] = { ...copy[i], unitPrice: item.unitPrice, qty: copy[i].qty + item.qty };
      return copy;
    });
  };

  const addTyped = () => {
    const clean = cleanName(name);
    const p = parseNumber(price);
    const q = parseNumber(quantity);
    if (!productKey(clean)) return setError("Écris le nom de l'article.");
    if (!(p >= 0) || Number.isNaN(p)) return setError('Écris le prix, par exemple 12,50.');
    if (!(q > 0)) return setError('La quantité doit être plus grande que zéro.');
    upsert({ name: match ? match.name : clean, unit: shownUnit, qty: q, unitPrice: p, last: editId ? null : match?.last_price ?? null, known: !!match });
    setName('');
    setPrice('');
    setQuantity('1');
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

  /** Moves a basket line back into the form so its price or quantity can be corrected. */
  const editLine = (index: number) => {
    const it = items[index];
    setName(it.name);
    setUnit(it.unit);
    setPrice(String(it.unitPrice).replace('.', ','));
    setQuantity(fmtQty(it.qty));
    setItems((cur) => cur.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
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
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
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

            <View style={st.numbers}>
              <View style={ui.flex}>
                <Text style={st.label}>Prix pour 1 {shownUnit}</Text>
                <TextInput
                  accessibilityLabel={`Prix en dirhams pour 1 ${shownUnit}`}
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
              <Pressable accessibilityRole="button" accessibilityLabel="Ajouter l'article au panier" onPress={addTyped} style={({ pressed }) => [st.add, pressed && ui.pressed]}>
                <Ionicons name="add" size={28} color={colors.white} />
              </Pressable>
            </View>
          </Card>

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
                return (
                  <Card key={productKey(it.name)} style={st.line}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Corriger ${it.name}`} onPress={() => editLine(i)} style={st.lineMain}>
                      <Text style={t.name}>{it.name}</Text>
                      <Text style={t.meta}>
                        {money(it.unitPrice)} MAD / {it.unit}
                      </Text>
                      {diff === null ? (
                        it.known ? null : <Chip label="Nouveau produit" />
                      ) : diff === 0 ? (
                        <Chip label="Même prix" />
                      ) : (
                        <Chip label={`${diff > 0 ? '+' : '−'}${money(Math.abs(diff))} depuis la dernière fois`} tone={diff > 0 ? 'up' : 'down'} />
                      )}
                    </Pressable>
                    <View style={st.stepper}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${fmtQty(stepFor(it.unit))} ${it.unit}`} onPress={() => changeQty(i, -1)} style={st.step}>
                        <Ionicons name="remove" size={20} color={colors.ink} />
                      </Pressable>
                      <Text style={st.stepValue}>{fmtQty(it.qty)}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter ${fmtQty(stepFor(it.unit))} ${it.unit}`} onPress={() => changeQty(i, 1)} style={st.step}>
                        <Ionicons name="add" size={20} color={colors.ink} />
                      </Pressable>
                    </View>
                    <Text style={st.lineTotal}>{money(it.qty * it.unitPrice)}</Text>
                  </Card>
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

const st = StyleSheet.create({
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
  add: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.danger, marginTop: 10, paddingHorizontal: 4 },
  basketHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingTop: 18, paddingBottom: 8 },
  basketTitle: { fontFamily: fonts.title, fontSize: 18, color: colors.ink },
  basket: { gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingRight: 12 },
  lineMain: { flex: 1, minWidth: 0, gap: 3, minHeight: 44, justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  step: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.neutral, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontFamily: fonts.title, fontSize: 17, color: colors.ink, minWidth: 30, textAlign: 'center' },
  lineTotal: { fontFamily: fonts.title, fontSize: 17, color: colors.ink, minWidth: 64, textAlign: 'right' },
  footer: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, gap: 10, elevation: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.muted, flex: 1 },
  total: { fontFamily: fonts.title, fontSize: 28, color: colors.ink },
});
