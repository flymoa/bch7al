// "Prix" tab ("bch7al ?"): type a product, see your best price and where, how it moved,
// and whether the price in front of you is a good one.
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FadeIn, GrowBar, Pop } from '@/components/motion';
import { showToast } from '@/components/toast';
import { Button, Card, Empty, RowCard, Screen, Tile, VerdictBadge, s as ui, t } from '@/components/ui';
import { addListItem, getProduct, listProducts, pricesByStore, productHistory, type HistoryRow, type ProductRow, type StorePrice } from '@/db';
import { money, parseNumber, pct, plural, shortDate, verdict } from '@/format';
import { colors, fonts, sheet, useTheme } from '@/theme';

const per = (unit: string) => (unit === 'pièce' ? '' : ` / ${unit}`);

export default function Ask() {
  useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductRow[]>([]);
  const [picked, setPicked] = useState<ProductRow | null>(null);
  const [where, setWhere] = useState<StorePrice[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [seen, setSeen] = useState('');

  const pick = async (p: ProductRow) => {
    const [w, h] = await Promise.all([pricesByStore(db, p.id), productHistory(db, p.id)]);
    setWhere(w);
    setHistory(h.slice(-6));
    setSeen('');
    setPicked(p);
  };

  useEffect(() => {
    if (params.id) getProduct(db, Number(params.id)).then((p) => p && pick(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, params.id]);

  useEffect(() => {
    let alive = true;
    listProducts(db, query, 'frequent', 30).then((rows) => {
      if (alive) setResults(rows.filter((p) => p.last_price !== null && !/timbre/i.test(p.name)).slice(0, 8));
    });
    return () => {
      alive = false;
    };
  }, [db, query]);

  const usual = picked?.avg_price ?? null;
  const best = where[0] ?? null;
  const maxStore = Math.max(...where.map((w) => w.price), 0.01);
  const seenPrice = parseNumber(seen);
  const v = seen.trim() && seenPrice >= 0 ? verdict(seenPrice, usual) : null;
  const bestVerdict = best && where.length > 1 ? verdict(best.price, usual) : null;
  const hLow = Math.min(...history.map((h) => h.unit_price));
  const hHigh = Math.max(...history.map((h) => h.unit_price));
  const hSpan = hHigh - hLow || 1;
  const moved = history.length > 1 ? history[history.length - 1].unit_price - history[0].unit_price : 0;

  const searchBar = (
    <View style={st.search}>
      <Text style={st.searchLead}>Bch7al…</Text>
      {picked ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${picked.name}, chercher un autre produit`} onPress={() => setPicked(null)} style={st.pickedName}>
          <Text style={st.searchInput} numberOfLines={1}>{picked.name}</Text>
        </Pressable>
      ) : (
        <TextInput
          accessibilityLabel="Nom du produit"
          value={query}
          onChangeText={setQuery}
          placeholder="le lait, l'huile, le thé"
          placeholderTextColor={colors.muted}
          style={st.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
      )}
      {picked || query ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Effacer"
          onPress={() => {
            setPicked(null);
            setQuery('');
          }}
          style={st.searchBtn}
        >
          <Ionicons name="close" size={20} color={colors.white} />
        </Pressable>
      ) : (
        <View style={st.searchBtn}>
          <Text style={st.searchQ}>?</Text>
        </View>
      )}
    </View>
  );

  return (
    <Screen bottomBar="ask">
      <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          {searchBar}
          {picked ? (
            <>
              <Pop>
                <View style={st.hero}>
                  <View style={st.heroTop}>
                    <Text style={st.heroLabel}>{where.length > 1 ? 'Ton meilleur prix' : 'Ton dernier prix'}</Text>
                    {bestVerdict ? <VerdictBadge v={bestVerdict} onNight /> : null}
                  </View>
                  <View style={st.heroRow}>
                    <Text style={st.heroPrice} adjustsFontSizeToFit numberOfLines={1}>{money(best?.price ?? picked.last_price ?? 0)}</Text>
                    <Text style={st.heroUnit}>MAD{per(picked.unit)}</Text>
                  </View>
                  {best ? (
                    <Text style={st.heroMeta}>
                      chez <Text style={st.heroStrong}>{best.store}</Text> · vu le {shortDate(best.date)}
                    </Text>
                  ) : null}
                  <Text style={st.heroSmall}>
                    D'habitude {money(usual ?? 0)} MAD · acheté {plural(picked.n, 'fois', 'fois')}
                  </Text>
                </View>
              </Pop>

              {where.length > 0 ? (
                <View style={st.section}>
                  <Text style={st.title}>Chez qui ?</Text>
                  {where.map((w, i) => (
                    <View key={w.store} style={st.storeRow}>
                      <Text style={[st.storeName, i === 0 && st.storeNameBest]} numberOfLines={1}>{w.store}</Text>
                      <View style={st.storeTrack}>
                        <View style={[st.storeBar, { width: `${Math.max(18, (w.price / maxStore) * 100)}%`, backgroundColor: i === 0 && where.length > 1 ? colors.blue : colors.barSoft }]}>
                          {i === 0 && where.length > 1 ? <Text style={st.storeBarText} numberOfLines={1}>le moins cher</Text> : null}
                        </View>
                      </View>
                      <Text style={[st.storePrice, i === 0 && st.storeNameBest]}>{money(w.price)}</Text>
                    </View>
                  ))}
                  {where.length === 1 ? <Text style={t.meta}>Achète-le dans un autre magasin pour comparer.</Text> : null}
                </View>
              ) : null}

              {history.length > 1 ? (
                <Card style={st.block}>
                  <View style={st.blockHead}>
                    <Text style={st.title}>{plural(history.length, 'dernier prix', 'derniers prix')}</Text>
                    <Text style={t.meta}>
                      {Math.abs(moved) < 0.005 ? 'stable' : `${moved > 0 ? '+' : '−'}${money(Math.abs(moved))} MAD`}
                    </Text>
                  </View>
                  <View style={st.bars} accessible accessibilityLabel={history.map((h) => `${shortDate(h.date)} ${money(h.unit_price)} MAD`).join(', ')}>
                    {history.map((h, i) => (
                      <View key={i} style={st.barCol}>
                        <GrowBar index={i} height={24 + ((h.unit_price - hLow) / hSpan) * 48} color={i === history.length - 1 ? colors.blue : colors.barSoft} style={st.bar} />
                        <Text style={[st.barLabel, i === history.length - 1 && st.barLabelLast]} numberOfLines={1}>{shortDate(h.date)}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}

              <Card style={st.block}>
                <Text style={st.title}>Tu vois un prix en magasin ?</Text>
                <View style={st.seenRow}>
                  <TextInput
                    accessibilityLabel={`Prix vu en dirhams${per(picked.unit)}`}
                    value={seen}
                    onChangeText={setSeen}
                    placeholder="0,00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    style={st.seenInput}
                  />
                  <Text style={st.mad}>MAD{per(picked.unit)}</Text>
                </View>
                {v ? (
                  <View style={[st.verdict, v.kind === 'good' ? { backgroundColor: colors.blue } : v.kind === 'high' ? ui.upBox : { backgroundColor: colors.soft }]} accessibilityLiveRegion="polite">
                    <Text style={[st.verdictTitle, { color: v.kind === 'good' ? colors.white : colors.ink }]}>
                      {v.kind === 'good' ? 'Mzyan, prends-le !' : v.kind === 'high' ? 'Ghali' : 'Normal'}
                    </Text>
                    <Text style={[st.verdictText, { color: v.kind === 'good' ? colors.white : colors.ink }]}>
                      {v.kind === 'normal'
                        ? `À peu près ce que tu paies d'habitude (${money(usual ?? 0)} MAD).`
                        : `${pct(v.change)} ${v.change < 0 ? 'de moins' : 'de plus'} que d'habitude (${money(usual ?? 0)} MAD).`}
                      {best && seenPrice > best.price + 0.005 ? ` Tu l'as eu à ${money(best.price)} chez ${best.store}.` : ''}
                    </Text>
                  </View>
                ) : (
                  <Text style={t.meta}>Écris le prix affiché, je te dis si c'est mzyan ou ghali.</Text>
                )}
              </Card>

              <Button
                label="Ajouter à ma liste"
                icon="add"
                style={st.gap}
                onPress={async () => {
                  const added = await addListItem(db, picked.name);
                  showToast(added ? 'Ajouté à ta liste' : 'Déjà dans ta liste');
                }}
              />
              <Button label="Tout l'historique" icon="stats-chart-outline" tone="light" style={st.gapSmall} onPress={() => router.push(`/product/${picked.id}`)} />
            </>
          ) : results.length === 0 ? (
            <View style={st.gap}>
              <Empty
                title={query.trim() ? `Pas encore de prix pour « ${query.trim()} »` : 'Aucun prix noté pour le moment'}
                text="Note-le dans une course, et la prochaine fois je te dirai combien tu le paies."
              />
            </View>
          ) : (
            <>
              <Text style={st.label}>{query.trim() ? 'Touche un produit' : 'Tes produits habituels'}</Text>
              <View style={st.list}>
                {results.map((p, i) => (
                  <FadeIn key={p.id} index={i}>
                    <RowCard label={p.name} onPress={() => pick(p)}>
                      <Tile text={p.name} />
                      <View style={ui.flex}>
                        <Text style={t.name} numberOfLines={1}>{p.name}</Text>
                        <Text style={t.meta}>Acheté {p.n} fois</Text>
                      </View>
                      <Text style={t.price}>{money(p.last_price ?? 0)} <Text style={t.unit}>MAD</Text></Text>
                    </RowCard>
                  </FadeIn>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = sheet(() => ({
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 28, borderWidth: 1, borderColor: colors.line, paddingLeft: 18, paddingRight: 6, minHeight: 56 },
  searchLead: { fontFamily: fonts.titleBold, fontSize: 16, color: colors.blue },
  searchInput: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, paddingVertical: 10 },
  pickedName: { flex: 1, minHeight: 44, justifyContent: 'center' },
  searchBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  searchQ: { fontFamily: fonts.titleBold, fontSize: 20, color: colors.white },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.muted, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  list: { gap: 8 },
  hero: { backgroundColor: colors.night, borderRadius: 28, paddingHorizontal: 22, paddingVertical: 20, gap: 4, marginTop: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.onNight },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  heroPrice: { fontFamily: fonts.titleBold, fontSize: 72, lineHeight: 84, letterSpacing: -2, color: colors.white, flexShrink: 1 },
  heroUnit: { fontFamily: fonts.title, fontSize: 20, color: colors.onNight },
  heroMeta: { fontFamily: fonts.body, fontSize: 15, color: colors.white },
  heroStrong: { fontFamily: fonts.bodyBold },
  heroSmall: { fontFamily: fonts.body, fontSize: 13, color: colors.onNight, marginTop: 4 },
  section: { marginTop: 18, gap: 6 },
  title: { fontFamily: fonts.title, fontSize: 17, color: colors.ink },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  storeName: { width: 82, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  storeNameBest: { fontFamily: fonts.bodyBold },
  storeTrack: { flex: 1 },
  storeBar: { height: 28, borderRadius: 14, justifyContent: 'center', paddingHorizontal: 10 },
  storeBarText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
  storePrice: { width: 70, textAlign: 'right', fontFamily: fonts.title, fontSize: 16, color: colors.ink },
  block: { marginTop: 12, gap: 12, padding: 16 },
  blockHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, minHeight: 92 },
  barCol: { flex: 1, alignItems: 'stretch', gap: 6 },
  bar: { borderRadius: 10 },
  barLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, textAlign: 'center' },
  barLabelLast: { fontFamily: fonts.bodyBold, color: colors.ink },
  seenRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seenInput: { flex: 1, backgroundColor: colors.bg, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14, minHeight: 56, fontFamily: fonts.title, fontSize: 24, color: colors.ink },
  mad: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.muted },
  verdict: { borderRadius: 18, padding: 14, gap: 2 },
  verdictTitle: { fontFamily: fonts.titleBold, fontSize: 22 },
  verdictText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  gap: { marginTop: 14 },
  gapSmall: { marginTop: 10 },
}));
