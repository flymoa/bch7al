import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Alert } from '@/alert';
import { FadeIn, GrowBar } from '@/components/motion';
import { Button, Card, ChangeChip, Chip, Empty, Header, Pill, RoundButton, Screen, SectionTitle, Tile, s as ui, t } from '@/components/ui';
import { getProduct, productHistory, updateProduct, type HistoryRow, type ProductRow } from '@/db';
import { money, productKey, shortDate } from '@/format';
import { colors, fonts, UNITS, sheet, useTheme } from '@/theme';
import { radius, space, tabular, type } from '@/tokens';

const CHART_POINTS = 16;

export default function ProductDetail() {
  useTheme();
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
          <View>
            <View style={st.head}>
              <Tile text={product.name} size={44} />
              <View style={ui.flex}>
                <Text style={st.name} numberOfLines={2}>{product.name}</Text>
                <Text style={t.meta}>Acheté {product.n} fois · par {product.unit}</Text>
              </View>
            </View>
            <View style={st.priceRow}>
              <Text style={st.price} adjustsFontSizeToFit numberOfLines={1}>{money(last.unit_price)}</Text>
              <Text style={st.priceUnit}>DH / {product.unit}</Text>
            </View>
          </View>
        )}

        <View style={st.chips}>
          {verdict ? <Chip label={verdict.label} tone={verdict.tone} /> : null}
          <Chip label={`Vu le ${shortDate(last.date)} chez ${last.store}`} />
        </View>

        <FadeIn index={1}><Card style={st.block}>
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
                  <GrowBar key={i} index={i} style={st.bar} height={space.xl + ((h.unit_price - chartLow) / chartSpan) * 72} color={i === chart.length - 1 ? colors.blue : colors.barSoft} />
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
            <View style={[st.stat, { backgroundColor: colors.upBg }, ui.upBox]}>
              <Text style={[st.statLabel, { color: colors.upText }]}>Plus haut</Text>
              <Text style={st.statValue}>{money(high)}</Text>
            </View>
            <View style={[st.stat, { backgroundColor: colors.neutral }]}>
              <Text style={[st.statLabel, { color: colors.muted }]}>Moyenne</Text>
              <Text style={st.statValue}>{money(avg)}</Text>
            </View>
          </View>
        </Card></FadeIn>

        <SectionTitle>Dernier prix par magasin</SectionTitle>
        <Card style={st.rows}>
          {stores.map((h, i) => (
            <View key={h.store} style={[st.rowLine, i > 0 && st.rowBorder]}>
              <Tile kind="store" text={h.store} size={34} />
              <View style={ui.flex}>
                <Text style={t.name} numberOfLines={1}>{h.store}</Text>
                <Text style={t.meta}>{shortDate(h.date)}</Text>
              </View>
              {i === 0 && stores.length > 1 && stores[1].unit_price > h.unit_price ? <Chip label="Le moins cher" tone="down" /> : null}
              <Text style={t.price}>{money(h.unit_price)}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle>Tous les achats</SectionTitle>
        <Card style={st.rows}>
          {[...history].reverse().slice(0, 40).map((h, i) => (
            <View key={i} style={[st.rowLine, i > 0 && st.rowBorder]}>
              <View style={ui.flex}>
                <Text style={t.name} numberOfLines={1}>{h.store}</Text>
                <Text style={t.meta}>{shortDate(h.date)}</Text>
              </View>
              <Text style={t.price}>{money(h.unit_price)}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const st = sheet(() => ({
  pad: { padding: space.lg },
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { fontFamily: fonts.title, fontSize: type.title, color: colors.ink },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.md },
  price: { fontFamily: fonts.titleBold, fontSize: type.priceHero, letterSpacing: -1.5, color: colors.ink, flexShrink: 1, ...tabular },
  priceUnit: { fontFamily: fonts.bodyMedium, fontSize: type.bodyLg, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  edit: { gap: space.md },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, paddingHorizontal: space.md, fontFamily: fonts.body, fontSize: type.bodyLg, color: colors.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  block: { marginTop: space.lg, gap: space.md, padding: space.lg },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  blockTitle: { fontFamily: fonts.title, fontSize: type.bodyLg, color: colors.ink, flex: 1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: space.xs, height: 96 },
  bar: { flex: 1, maxWidth: 28, borderTopLeftRadius: space.sm, borderTopRightRadius: space.sm, borderBottomLeftRadius: space.xs, borderBottomRightRadius: space.xs },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  statLabel: { fontFamily: fonts.bodyBold, fontSize: type.caption },
  statValue: { fontFamily: fonts.titleBold, fontSize: type.bodyLg, color: colors.ink, ...tabular },
  rows: { paddingVertical: space.xs },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingVertical: space.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
}));
