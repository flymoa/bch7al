// "bch7al ?" : type a product, see what you usually pay, where it is cheapest,
// and whether the price in front of you is a good one.
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FadeIn, Pop } from '@/components/motion';
import { Button, Card, Chip, Empty, Header, RowCard, Screen, Tile, s as ui, t } from '@/components/ui';
import { getProduct, listProducts, pricesByStore, type ProductRow, type StorePrice } from '@/db';
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
  const [seen, setSeen] = useState('');

  const pick = async (p: ProductRow) => {
    setWhere(await pricesByStore(db, p.id));
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
  const cheapest = where[0] ?? null;
  const latest = where.find((w) => w.latest) ?? null;
  const seenPrice = parseNumber(seen);
  const v = seen.trim() && seenPrice >= 0 ? verdict(seenPrice, usual) : null;

  return (
    <Screen>
      <Header title="bch7al ?" />
      <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          {picked ? (
            <>
              <Pop>
                <View style={st.hero}>
                  <Text style={st.heroName}>{picked.name}</Text>
                  <Text style={st.heroMeta}>D'habitude tu le paies</Text>
                  <View style={st.heroRow}>
                    <Text style={st.heroPrice}>{money(usual ?? 0)}</Text>
                    <Text style={st.heroUnit}>MAD{per(picked.unit)}</Text>
                  </View>
                  {latest ? (
                    <Text style={st.heroMeta}>
                      Dernier achat : {money(picked.last_price ?? latest.price)} MAD chez {latest.store}, {shortDate(latest.date)} · acheté {picked.n} fois
                    </Text>
                  ) : null}
                </View>
              </Pop>

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
                    style={[st.input, st.seenInput]}
                  />
                  <Text style={st.mad}>MAD{per(picked.unit)}</Text>
                </View>
                {v ? (
                  <View style={[st.verdict, { backgroundColor: v.kind === 'high' ? colors.upBg : colors.soft }, v.kind === 'high' && ui.upBox]} accessibilityLiveRegion="polite">
                    <Ionicons name={v.kind === 'good' ? 'thumbs-up' : v.kind === 'high' ? 'alert-circle' : 'checkmark-circle'} size={26} color={v.kind === 'high' ? colors.upText : colors.softText} />
                    <View style={ui.flex}>
                      <Text style={[st.verdictTitle, { color: v.kind === 'high' ? colors.upText : colors.softText }]}>
                        {v.kind === 'good' ? 'Mzyan, prends-le !' : v.kind === 'high' ? 'Ghali' : 'Prix habituel'}
                      </Text>
                      <Text style={[st.verdictText, { color: v.kind === 'high' ? colors.upText : colors.softText }]}>
                        {v.kind === 'normal'
                          ? `À peu près ce que tu paies d'habitude (${money(usual ?? 0)} MAD).`
                          : `${pct(v.change)} ${v.change < 0 ? 'de moins' : 'de plus'} que d'habitude (${money(usual ?? 0)} MAD).`}
                        {cheapest && seenPrice > cheapest.price + 0.005 ? ` Tu l'as eu à ${money(cheapest.price)} chez ${cheapest.store}.` : ''}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={t.meta}>Écris le prix affiché, je te dis si c'est une bonne affaire.</Text>
                )}
              </Card>

              <Card style={st.block}>
                <Text style={st.title}>Où tu le paies le moins cher</Text>
                {where.map((w, i) => (
                  <View key={w.store} style={st.storeRow}>
                    <Tile kind="store" text={w.store} size={40} />
                    <View style={ui.flex}>
                      <Text style={t.name} numberOfLines={1}>{w.store}</Text>
                      <Text style={t.meta}>{shortDate(w.date)} · {plural(w.n, 'achat', 'achats')}</Text>
                    </View>
                    <View style={st.right}>
                      <Text style={t.price}>{money(w.price)} <Text style={t.unit}>MAD</Text></Text>
                      {i === 0 && where.length > 1 && where[1].price > w.price ? <Chip label="Le moins cher" tone="down" icon="trophy-outline" /> : null}
                    </View>
                  </View>
                ))}
                {where.length === 1 ? <Text style={t.meta}>Achète-le dans un autre magasin pour comparer.</Text> : null}
              </Card>

              <Button label="Voir tout l'historique" icon="stats-chart-outline" tone="light" onPress={() => router.push(`/product/${picked.id}`)} />
              <Button label="Chercher un autre produit" icon="search" onPress={() => setPicked(null)} style={st.gap} />
            </>
          ) : (
            <>
              <View style={st.search}>
                <Ionicons name="search" size={22} color={colors.blue} />
                <TextInput
                  accessibilityLabel="Nom du produit"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Bch7al… le lait ? l'huile ?"
                  placeholderTextColor={colors.muted}
                  style={st.searchInput}
                  autoFocus
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Effacer" onPress={() => setQuery('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={22} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
              {results.length === 0 ? (
                <Empty
                  title={query.trim() ? `Pas encore de prix pour « ${query.trim()} »` : 'Aucun prix noté pour le moment'}
                  text="Note-le dans une course, et la prochaine fois je te dirai combien tu le paies."
                />
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
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = sheet(() => ({
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 28 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 26, borderWidth: 2, borderColor: colors.blue, paddingHorizontal: 16, minHeight: 56 },
  searchInput: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink, paddingVertical: 10 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.muted, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  list: { gap: 8 },
  hero: { backgroundColor: colors.night, borderRadius: 28, padding: 20, gap: 2 },
  heroName: { fontFamily: fonts.title, fontSize: 22, color: colors.white, marginBottom: 6 },
  heroMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.white },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroPrice: { fontFamily: fonts.title, fontSize: 46, color: colors.white },
  heroUnit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  block: { marginTop: 12, gap: 10 },
  title: { fontFamily: fonts.title, fontSize: 18, color: colors.ink },
  seenRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { backgroundColor: colors.bg, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14, minHeight: 52, fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  seenInput: { flex: 1, fontSize: 22, fontFamily: fonts.title },
  mad: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.muted },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  verdictTitle: { fontFamily: fonts.title, fontSize: 20 },
  verdictText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  right: { alignItems: 'flex-end', gap: 3 },
  gap: { marginTop: 10 },
}));
