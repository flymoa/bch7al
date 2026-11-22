// One product's price memory: last price and verdict, the step chart with the usual-price
// band, the price in each store, every purchase, and its other spellings (aliases).
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Alert } from '@/alert';
import { FadeIn } from '@/components/motion';
import { showToast } from '@/components/toast';
import { Button, Empty, Field, Group, IconButton, Pill, PriceChip, Row, Screen, SectionHeader, StepChart, Tile, TopBar, VerdictChip, s as ui, t } from '@/components/ui';
import { addListItem, getProduct, listAliases, productHistory, removeAlias, updateProduct, type HistoryRow, type ProductRow } from '@/db';
import { basePrice, money, perUnit, plural, productKey, shortDate, verdict } from '@/format';
import { useSQLiteContext } from '@/sqlite';
import { bubble, colors, price as pc, sheet, text, UNITS, useTheme } from '@/theme';
import { radius, size, space } from '@/tokens';

const CHART_POINTS = 16;

export default function ProductDetail() {
  useTheme();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Number(id);
  const [product, setProduct] = useState<ProductRow | null | undefined>(undefined);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [aliases, setAliases] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<string>(UNITS[0]);
  const [chartW, setChartW] = useState(0);

  const load = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([getProduct(db, productId), productHistory(db, productId)]);
      setProduct(p);
      setHistory(h);
      setAliases(await listAliases(db, productId).catch(() => []));
    } catch {
      setProduct(null);
    }
  }, [db, productId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (product === undefined) return <Screen><TopBar /></Screen>;
  if (product === null || history.length === 0) {
    return (
      <Screen>
        <TopBar title="Produit" />
        <View style={st.pad}><Empty icon="products" title="Produit introuvable" text="Il n'est plus dans aucune course." /></View>
      </Screen>
    );
  }

  const prices = history.map((h) => h.unit_price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const last = history[history.length - 1];
  // The verdict of the last purchase compares it with the 3 regular-price purchases before it.
  const before = history.slice(0, -1).filter((h) => !h.promo).slice(-3);
  const usualBefore = before.length ? before.reduce((a, h) => a + h.unit_price, 0) / before.length : null;
  const v = verdict(last.unit_price, usualBefore);
  const base = basePrice(last.unit_price, product.unit, product.name);
  const chart = history.slice(-CHART_POINTS);
  const latestByStore = new Map<string, HistoryRow>();
  for (const h of history) latestByStore.set(h.store, h);
  const stores = [...latestByStore.values()].sort((a, b) => a.unit_price - b.unit_price);

  const startEdit = () => { setName(product.name); setUnit(product.unit); setEditing(true); };
  const saveEdit = async () => {
    if (!productKey(name)) return Alert.alert('Nom manquant', 'Écris le nom du produit.');
    try {
      const target = await updateProduct(db, product.id, name, unit);
      setEditing(false);
      if (target !== product.id) {
        showToast('Produits regroupés : un seul historique');
        router.replace(`/product/${target}`);
      } else await load();
    } catch (e) {
      Alert.alert('La modification a échoué', String((e as Error).message ?? e));
    }
  };

  return (
    <Screen>
      <TopBar right={<IconButton icon={editing ? 'close' : 'edit'} label={editing ? 'Annuler' : 'Renommer ou regrouper'} onPress={() => (editing ? setEditing(false) : startEdit())} />} />
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        {editing ? (
          <View style={st.edit}>
            <Text style={t.label}>NOM DU PRODUIT</Text>
            <Field accessibilityLabel="Nom du produit" value={name} onChangeText={setName} autoFocus />
            <Text style={t.label}>VENDU PAR</Text>
            <View style={st.wrap}>{UNITS.map((u) => <Pill key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />)}</View>
            <Text style={t.body}>Donne le nom d'un produit qui existe déjà et les deux historiques seront regroupés. L'ancien nom reste reconnu sur les tickets.</Text>
            <Button label="Enregistrer" icon="check" onPress={saveEdit} />
          </View>
        ) : (
          <View style={st.head}>
            <View style={st.titleRow}>
              <Tile text={product.name} />
              <View style={ui.flex}>
                <Text style={st.name} numberOfLines={2}>{product.name}</Text>
                <Text style={t.meta}>{plural(product.n, 'achat', 'achats')} · par {product.unit}</Text>
              </View>
            </View>
            <View style={st.priceRow}>
              <Text style={st.price} adjustsFontSizeToFit numberOfLines={1}>{money(last.unit_price)}</Text>
              <Text style={st.priceUnit}>DH{perUnit(product.unit)}</Text>
            </View>
            <View style={st.chips}>
              {v ? <VerdictChip v={v} count={before.length} /> : null}
              {last.promo ? <PriceChip dir="down" label="Promo" /> : null}
              {base && product.unit !== base.base ? <Text style={t.meta}>soit {money(base.price)} DH/{base.base}</Text> : null}
            </View>
            <Text style={t.meta}>Dernier achat le {shortDate(last.date)} chez {last.store}</Text>
          </View>
        )}

        <FadeIn index={1}>
          <View style={st.block} onLayout={(e) => setChartW(Math.round(e.nativeEvent.layout.width) - space.lg * 2)}>
            <Text style={st.blockTitle}>Son prix dans le temps</Text>
            {history.length < 2 ? (
              <Text style={t.body}>Ajoute un 2ᵉ achat pour voir l'évolution.</Text>
            ) : (
              <View accessible accessibilityRole="image" accessibilityLabel={`De ${money(chart[0].unit_price)} à ${money(last.unit_price)} dirhams sur ${chart.length} achats`}>
                <StepChart width={chartW} points={chart.map((h) => ({ v: h.unit_price, promo: !!h.promo }))} usual={product.avg_price} />
                <View style={st.axis}>
                  <Text style={t.meta}>{shortDate(chart[0].date)}</Text>
                  <Text style={t.meta}>bande = ton prix habituel · ◦ = promo</Text>
                  <Text style={t.meta}>{shortDate(last.date)}</Text>
                </View>
              </View>
            )}
            <View style={st.stats}>
              <View style={[st.stat, { backgroundColor: pc.downBg }]}>
                <Text style={[st.statLabel, { color: pc.downFg }]}>Plus bas</Text>
                <Text style={[st.statValue, { color: pc.downFg }]}>{money(low)}</Text>
              </View>
              <View style={[st.stat, { backgroundColor: pc.upBg }]}>
                <Text style={[st.statLabel, { color: pc.upFg }]}>Plus haut</Text>
                <Text style={[st.statValue, { color: pc.upFg }]}>{money(high)}</Text>
              </View>
              <View style={[st.stat, { backgroundColor: pc.sameBg }]}>
                <Text style={[st.statLabel, { color: pc.sameFg }]}>Moyenne</Text>
                <Text style={[st.statValue, { color: colors.ink }]}>{money(avg)}</Text>
              </View>
            </View>
          </View>
        </FadeIn>

        <View style={st.actions}>
          <Button kind="tonal" icon="list" label="À ma liste" compact style={ui.flex} onPress={async () => showToast((await addListItem(db, product.name)) ? 'Ajouté à ta liste' : 'Déjà dans ta liste')} />
          <Button kind="outline" icon="search" label="Prix en magasin" compact style={ui.flex} onPress={() => router.push(`/ask?id=${product.id}`)} />
        </View>

        <SectionHeader title="Dernier prix par magasin" />
        <Group>
          {stores.map((h, i) => (
            <Row
              key={h.store}
              first={i === 0}
              label={`${h.store}, ${money(h.unit_price)} dirhams`}
              leading={<Tile kind="store" text={h.store} />}
              title={h.store}
              meta={shortDate(h.date)}
              price={money(h.unit_price)}
              chip={i === 0 && stores.length > 1 && stores[1].unit_price > h.unit_price ? <PriceChip dir="down" label="Le moins cher" /> : null}
            />
          ))}
        </Group>

        {aliases.length > 0 ? (
          <>
            <SectionHeader title="Autres noms reconnus" />
            <Group>
              {aliases.map((a, i) => (
                <Row
                  key={a}
                  first={i === 0}
                  dense
                  title={<Text style={st.alias} numberOfLines={1}>{a.toUpperCase()}</Text>}
                  meta="lu sur un ticket"
                  right={<IconButton icon="close" label={`Oublier ${a}`} onPress={async () => { await removeAlias(db, a); load(); }} />}
                />
              ))}
            </Group>
          </>
        ) : null}

        <SectionHeader title="Tous les achats" />
        <Group>
          {[...history].reverse().slice(0, 40).map((h, i) => (
            <Row key={i} first={i === 0} dense title={h.store} meta={`${shortDate(h.date)}${h.promo ? ' · promo' : ''}`} price={money(h.unit_price)} />
          ))}
        </Group>
      </ScrollView>
    </Screen>
  );
}

const st = sheet(() => ({
  pad: { paddingHorizontal: size.screen },
  content: { paddingHorizontal: size.screen, paddingBottom: space.section, gap: space.md },
  head: { gap: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { ...text('titleLg'), color: colors.ink },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm },
  price: { ...text('display'), color: colors.ink, flexShrink: 1 },
  priceUnit: { ...text('title'), color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  edit: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  block: { backgroundColor: colors.surfaceContainer, borderRadius: radius.card, padding: space.lg, gap: space.md, marginTop: space.lg },
  blockTitle: { ...text('title'), color: colors.ink },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, ...bubble('sm'), paddingVertical: space.md, paddingHorizontal: space.md, gap: space.xxs },
  statLabel: { ...text('labelSm') },
  statValue: { ...text('priceRow') },
  actions: { flexDirection: 'row', gap: space.sm },
  alias: { ...text('label'), color: colors.ink, letterSpacing: 0.4 },
}));
