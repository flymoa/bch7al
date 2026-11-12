import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/alert';
import { Button, Card, ChangeChip, Chip, Empty, Header, Pill, RoundButton, Screen, Tile, s as ui, t } from '@/components/ui';
import { getProduct, productHistory, updateProduct, type HistoryRow, type ProductRow } from '@/db';
import { money, productKey, shortDate } from '@/format';
import { colors, fonts, UNITS } from '@/theme';

const CHART_POINTS = 16;

export default function ProductDetail() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Number(id);
  const [product, setProduct] = useState<ProductRow | null | undefined>(undefined);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<string>(UNITS[0]);

  const load = useCallback(async () => {
    const [p, h] = await Promise.all([getProduct(db, productId), productHistory(db, productId)]);
    setProduct(p);
    setHistory(h);
  }, [db, productId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (product === undefined) return <Screen><Header title="Produit" /></Screen>;
  if (product === null || history.length === 0) {
    return (
      <Screen>
        <Header title="Produit" />
        <View style={st.pad}>
          <Empty title="Produit introuvable" text="Il n'est plus dans aucune course." />
        </View>
      </Screen>
    );
  }

  const prices = history.map((h) => h.unit_price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const last = history[history.length - 1];
  const chart = history.slice(-CHART_POINTS);
  const chartLow = Math.min(...chart.map((h) => h.unit_price));
  const chartSpan = Math.max(Math.max(...chart.map((h) => h.unit_price)) - chartLow, 0.0001);

  // Latest price seen in each store, cheapest first.
  const latestByStore = new Map<string, HistoryRow>();
  for (const h of history) latestByStore.set(h.store, h);
  const stores = [...latestByStore.values()].sort((a, b) => a.unit_price - b.unit_price);

  let verdict: { label: string; tone: 'up' | 'down' | 'neutral' } | null = null;
  if (prices.length >= 3) {
    if (last.unit_price > avg * 1.03) verdict = { label: "Plus cher que d'habitude", tone: 'up' };
    else if (last.unit_price < avg * 0.97) verdict = { label: "Moins cher que d'habitude", tone: 'down' };
    else verdict = { label: 'Prix habituel', tone: 'neutral' };
  }

  const startEdit = () => {
    setName(product.name);
    setUnit(product.unit);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!productKey(name)) return Alert.alert('Nom manquant', 'Écris le nom du produit.');
    try {
      const target = await updateProduct(db, product.id, name, unit);
      setEditing(false);
      if (target !== product.id) {
        Alert.alert('Produits regroupés', 'Ce nom existait déjà. Les deux historiques de prix ont été réunis.');
        router.replace(`/product/${target}`);
      } else {
        await load();
      }
    } catch (e) {
      Alert.alert('La modification a échoué', String((e as Error).message ?? e));
    }
  };

  return (
    <Screen>
      <Header title="Produit" right={<RoundButton icon={editing ? 'close' : 'create-outline'} label={editing ? 'Annuler la modification' : 'Renommer le produit'} onPress={() => (editing ? setEditing(false) : startEdit())} />} />
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        {editing ? (
          <Card style={st.edit}>
            <Text style={t.label}>Nom du produit</Text>
            <TextInput accessibilityLabel="Nom du produit" value={name} onChangeText={setName} style={st.input} autoFocus />
            <Text style={t.label}>Vendu par</Text>
            <View style={st.wrap}>
              {UNITS.map((u) => (
                <Pill key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />
              ))}
            </View>
            <Text style={t.meta}>Si tu donnes le nom d'un produit qui existe déjà, les deux seront regroupés.</Text>
            <Button label="Enregistrer" onPress={saveEdit} />
          </Card>
        ) : (
          <View style={st.head}>
            <Tile text={product.name} size={76} />
            <View style={ui.flex}>
              <Text style={st.name}>{product.name}</Text>
              <Text style={t.meta}>
                Acheté {product.n} fois · par {product.unit}
              </Text>
              <View style={st.priceRow}>
                <Text style={st.price}>{money(last.unit_price)}</Text>
                <Text style={st.priceUnit}>MAD / {product.unit}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={st.chips}>
          {verdict ? <Chip label={verdict.label} tone={verdict.tone} /> : null}
          <Chip label={`Vu le ${shortDate(last.date)} chez ${last.store}`} />
        </View>

        <Card style={st.block}>
          <View style={st.blockHead}>
            <Text style={st.blockTitle}>Son prix dans le temps</Text>
            {history.length > 1 ? <ChangeChip from={history[0].unit_price} to={last.unit_price} /> : null}
          </View>
          {history.length < 2 ? (
            <Text style={t.meta}>Un seul prix noté pour l'instant. Le graphique apparaît dès le deuxième achat.</Text>
          ) : (
            <>
              <View
                style={st.chart}
                accessible
                accessibilityRole="image"
                accessibilityLabel={`Prix de ${money(chart[0].unit_price)} à ${money(last.unit_price)} dirhams sur les ${chart.length} derniers achats`}
              >
                {chart.map((h, i) => (
                  <View
                    key={i}
                    style={[st.bar, { height: 22 + ((h.unit_price - chartLow) / chartSpan) * 74, backgroundColor: i === chart.length - 1 ? colors.blue : '#C9D8FA' }]}
                  />
                ))}
              </View>
              <View style={st.axis}>
                <Text style={t.meta}>{shortDate(chart[0].date)}</Text>
                <Text style={t.meta}>{shortDate(last.date)}</Text>
              </View>
            </>
          )}
          <View style={st.stats}>
            <View style={[st.stat, { backgroundColor: colors.soft }]}>
              <Text style={[st.statLabel, { color: colors.softText }]}>Plus bas</Text>
              <Text style={st.statValue}>{money(low)}</Text>
            </View>
            <View style={[st.stat, { backgroundColor: colors.upBg }]}>
              <Text style={[st.statLabel, { color: colors.upText }]}>Plus haut</Text>
              <Text style={st.statValue}>{money(high)}</Text>
            </View>
            <View style={[st.stat, { backgroundColor: colors.neutral }]}>
              <Text style={[st.statLabel, { color: colors.muted }]}>Moyenne</Text>
              <Text style={st.statValue}>{money(avg)}</Text>
            </View>
          </View>
        </Card>

        <Text style={st.section}>Dernier prix par magasin</Text>
        <Card style={st.rows}>
          {stores.map((h, i) => (
            <View key={h.store} style={[st.rowLine, i > 0 && st.rowBorder]}>
              <Tile text={h.store} size={34} />
              <View style={ui.flex}>
                <Text style={t.name} numberOfLines={1}>{h.store}</Text>
                <Text style={t.meta}>{shortDate(h.date)}</Text>
              </View>
              {i === 0 && stores.length > 1 && stores[1].unit_price > h.unit_price ? <Chip label="Le moins cher" tone="down" /> : null}
              <Text style={t.price}>{money(h.unit_price)}</Text>
            </View>
          ))}
        </Card>

        <Text style={st.section}>Tous les achats</Text>
        <Card style={st.rows}>
          {[...history].reverse().slice(0, 40).map((h, i) => (
            <View key={i} style={[st.rowLine, i > 0 && st.rowBorder]}>
              <View style={ui.flex}>
                <Text style={t.name}>{shortDate(h.date)}</Text>
                <Text style={t.meta}>{h.store}</Text>
              </View>
              <Text style={t.price}>{money(h.unit_price)}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  pad: { padding: 16 },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontFamily: fonts.title, fontSize: 23, color: colors.ink },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  price: { fontFamily: fonts.title, fontSize: 38, color: colors.ink },
  priceUnit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  edit: { gap: 10 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  block: { marginTop: 14, gap: 10, padding: 16 },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  blockTitle: { fontFamily: fonts.title, fontSize: 18, color: colors.ink, flex: 1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 96 },
  bar: { flex: 1, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  statLabel: { fontFamily: fonts.bodyBold, fontSize: 12 },
  statValue: { fontFamily: fonts.title, fontSize: 18, color: colors.ink },
  section: { fontFamily: fonts.title, fontSize: 18, color: colors.ink, paddingHorizontal: 4, paddingTop: 18, paddingBottom: 8 },
  rows: { paddingVertical: 4 },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
});
