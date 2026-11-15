// "Prix" tab ("bch7al ?"): type a product, see your best price and where, how it moved,
// and whether the price in front of you is a good one.
import { Icon } from '@/components/icon';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FadeIn, Pop } from '@/components/motion';
import { showToast } from '@/components/toast';
import { Empty, RowCard, Screen, Tile, s as ui, t } from '@/components/ui';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { addListItem, getProduct, listProducts, pricesByStore, productHistory, type HistoryRow, type ProductRow, type StorePrice } from '@/db';
import { money, parseNumber, pct, plural, shortDate, verdict } from '@/format';
import { bubble, bubbleRight, colors, fonts, shadow, sheet, useTheme } from '@/theme';

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
  const [chartW, setChartW] = useState(270);

  const pick = async (p: ProductRow) => {
    const [w, h] = await Promise.all([pricesByStore(db, p.id), productHistory(db, p.id)]);
    setWhere(w);
    setHistory(h.slice(-8));
    setQuery('');
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

  const others = where.slice(1);
  const maxOther = Math.max(...others.map((w) => w.price), 0.01);
  // Price line: one point per purchase, newest on the right.
  const W = Math.max(120, chartW), H = 64;
  const pts = history.map((h, i) => [history.length > 1 ? (i / (history.length - 1)) * (W - 12) + 6 : W / 2, 8 + (1 - (h.unit_price - hLow) / hSpan) * (H - 16)] as const);

  const input = (
    <View style={st.inputBar}>
      <Text style={st.inputLead}>Bch7al…</Text>
      <TextInput
        accessibilityLabel="Nom du produit"
        value={query}
        onChangeText={(v) => {
          setQuery(v);
          if (picked) setPicked(null);
        }}
        placeholder={picked ? 'autre chose' : "le lait, l'huile, le thé"}
        placeholderTextColor={colors.muted}
        style={st.input}
        autoCorrect={false}
        returnKeyType="search"
      />
      {query ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Effacer" onPress={() => setQuery('')} style={st.inputBtn}>
          <Icon name="close" size={20} color="#FFFFFF" />
        </Pressable>
      ) : (
        <View style={st.inputBtn}>
          <Text style={st.inputQ}>?</Text>
        </View>
      )}
    </View>
  );

  return (
    <Screen bottomBar="ask">
      <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <View style={st.head}>
            <Text style={st.h1}>Prix</Text>
          </View>
          {picked ? (
            <>
              <Pop style={st.right}>
                <View style={st.question}>
                  <Text style={st.questionText}>Bch7al {picked.name} ?</Text>
                </View>
              </Pop>

              <Pop>
                <View style={st.answer}>
                  <View style={st.answerTop}>
                    <Text style={st.answerLabel}>{where.length > 1 ? 'Ton meilleur prix' : 'Ton dernier prix'}</Text>
                    {bestVerdict && bestVerdict.kind === 'good' ? (
                      <View style={st.answerBadge}>
                        <Icon name="arrow-down" size={13} color={colors.blue} />
                        <Text style={st.answerBadgeText}>Mzyan</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={st.answerRow}>
                    <Text style={st.answerPrice} adjustsFontSizeToFit numberOfLines={1}>{money(best?.price ?? picked.last_price ?? 0)}</Text>
                    <Text style={st.answerUnit}>DH{per(picked.unit)}</Text>
                  </View>
                  {best ? (
                    <Text style={st.answerMeta}>
                      chez <Text style={st.strong}>{best.store}</Text> · vu le {shortDate(best.date)}
                    </Text>
                  ) : null}
                  <Text style={st.answerSmall}>
                    D'habitude {money(usual ?? 0)} DH · acheté {plural(picked.n, 'fois', 'fois')}
                  </Text>
                </View>
              </Pop>

              {others.length > 0 ? (
                <FadeIn index={1}>
                  <View style={st.bubbleCard}>
                    <Text style={st.cardTitle}>Ailleurs</Text>
                    {others.map((w) => (
                      <View key={w.store} style={st.otherRow}>
                        <Text style={st.otherName} numberOfLines={1}>{w.store}</Text>
                        <View style={st.otherTrack}>
                          <View style={[st.otherBar, { width: `${Math.max(12, (w.price / maxOther) * 100)}%` }]} />
                        </View>
                        <Text style={st.otherPrice}>{money(w.price)}</Text>
                      </View>
                    ))}
                  </View>
                </FadeIn>
              ) : null}

              {history.length > 1 ? (
                <FadeIn index={2}>
                  <View style={st.bubbleCard}>
                    <View style={st.cardHead}>
                      <Text style={st.cardTitle}>Depuis le {shortDate(history[0].date)}</Text>
                      <Text style={t.meta}>{Math.abs(moved) < 0.005 ? 'stable' : `${moved > 0 ? '+' : '−'}${money(Math.abs(moved))} DH`}</Text>
                    </View>
                    <View accessible accessibilityLabel={history.map((h) => `${shortDate(h.date)} ${money(h.unit_price)} DH`).join(', ')} onLayout={(e) => setChartW(Math.round(e.nativeEvent.layout.width))}>
                      <Svg width={W} height={H}>
                        <Polyline points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke={colors.blue} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                        <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={11} fill={colors.blue} opacity={0.18} />
                        <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={6} fill={colors.blue} />
                      </Svg>
                      <View style={st.chartLabels}>
                        <Text style={t.meta}>{shortDate(history[0].date)}</Text>
                        <Text style={[t.meta, st.strong]}>{shortDate(history[history.length - 1].date)}</Text>
                      </View>
                    </View>
                  </View>
                </FadeIn>
              ) : null}

              <View style={st.bubbleCard}>
                <Text style={st.cardTitle}>Tu vois un prix en magasin ?</Text>
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
                  <Text style={st.mad}>DH{per(picked.unit)}</Text>
                </View>
                {v ? (
                  <View style={[st.verdict, v.kind === 'good' ? { backgroundColor: colors.blue } : v.kind === 'high' ? ui.upBox : { backgroundColor: colors.soft }]} accessibilityLiveRegion="polite">
                    <Text style={[st.verdictTitle, { color: v.kind === 'good' ? '#FFFFFF' : colors.ink }]}>
                      {v.kind === 'good' ? 'Mzyan, chri !' : v.kind === 'high' ? 'Ghali' : 'Normal'}
                    </Text>
                    <Text style={[st.verdictText, { color: v.kind === 'good' ? '#FFFFFF' : colors.ink }]}>
                      {v.kind === 'normal'
                        ? `À peu près ce que tu paies d'habitude (${money(usual ?? 0)} DH).`
                        : `${pct(v.change)} ${v.change < 0 ? 'de moins' : 'de plus'} que d'habitude (${money(usual ?? 0)} DH).`}
                      {best && seenPrice > best.price + 0.005 ? ` Tu l'as eu à ${money(best.price)} chez ${best.store}.` : ''}
                    </Text>
                  </View>
                ) : (
                  <Text style={t.meta}>Écris le prix affiché, je te dis si c'est mzyan ou ghali.</Text>
                )}
              </View>

              <View style={st.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={async () => {
                    const added = await addListItem(db, picked.name);
                    showToast(added ? 'Ajouté à ta liste' : 'Déjà dans ta liste');
                  }}
                  style={({ pressed }) => [st.action, st.actionMain, pressed && ui.pressed]}
                >
                  <Text style={st.actionMainText}>Ajouter à ma liste</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push(`/product/${picked.id}`)} style={({ pressed }) => [st.action, pressed && ui.pressed]}>
                  <Text style={st.actionText}>Tout l'historique</Text>
                </Pressable>
              </View>
            </>
          ) : results.length === 0 ? (
            <Empty
              title={query.trim() ? `Pas encore de prix pour « ${query.trim()} »` : 'Aucun prix noté pour le moment'}
              text="Note-le dans une course, et la prochaine fois je te dirai combien tu le paies."
            />
          ) : (
            <>
              <View style={st.hint}>
                <Text style={st.hintText}>{query.trim() ? 'Touche un produit' : 'Demande-moi un prix. Tes produits habituels :'}</Text>
              </View>
              <View style={st.list}>
                {results.map((p, i) => (
                  <FadeIn key={p.id} index={i}>
                    <RowCard label={p.name} onPress={() => pick(p)}>
                      <Tile text={p.name} />
                      <View style={ui.flex}>
                        <Text style={t.name} numberOfLines={1}>{p.name}</Text>
                        <Text style={t.meta}>Acheté {p.n} fois</Text>
                      </View>
                      <Text style={t.price}>{money(p.last_price ?? 0)} <Text style={t.unit}>DH</Text></Text>
                    </RowCard>
                  </FadeIn>
                ))}
              </View>
            </>
          )}
        </ScrollView>
        {input}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = sheet(() => ({
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  h1: { fontFamily: fonts.titleBold, fontSize: 28, letterSpacing: -0.6, color: colors.ink },
  right: { alignSelf: 'flex-end', maxWidth: '86%' },
  question: { backgroundColor: colors.night, ...bubbleRight(24), paddingHorizontal: 18, paddingVertical: 13 },
  questionText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: '#FFFFFF' },
  answer: { backgroundColor: colors.blue, ...bubble(26), padding: 20, gap: 4, maxWidth: 330 },
  answerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  answerLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.onBlue },
  answerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 11, borderRadius: 14, backgroundColor: '#FFFFFF' },
  answerBadgeText: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#3D3BD9' },
  answerRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  answerPrice: { fontFamily: fonts.titleBold, fontSize: 68, lineHeight: 80, letterSpacing: -2.5, color: '#FFFFFF', flexShrink: 1 },
  answerUnit: { fontFamily: fonts.bodyMedium, fontSize: 20, color: colors.onBlue },
  answerMeta: { fontFamily: fonts.body, fontSize: 15, color: '#FFFFFF' },
  answerSmall: { fontFamily: fonts.body, fontSize: 13, color: colors.onBlue, marginTop: 2 },
  strong: { fontFamily: fonts.bodyBold },
  bubbleCard: { alignSelf: 'stretch', backgroundColor: colors.card, ...bubble(24), padding: 16, gap: 10, maxWidth: 340, ...shadow },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  otherRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  otherName: { width: 76, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  otherTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.soft },
  otherBar: { height: 8, borderRadius: 4, backgroundColor: colors.barSoft },
  otherPrice: { width: 48, textAlign: 'right', fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  seenRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seenInput: { flex: 1, minWidth: 0, width: '100%', backgroundColor: colors.bg, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14, minHeight: 54, fontFamily: fonts.title, fontSize: 22, color: colors.ink },
  mad: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.muted },
  verdict: { ...bubble(18), padding: 14, gap: 2 },
  verdictTitle: { fontFamily: fonts.titleBold, fontSize: 20 },
  verdictText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, justifyContent: 'center' },
  actionMain: { borderColor: colors.blue },
  actionText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  actionMainText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.blue },
  hint: { alignSelf: 'flex-start', backgroundColor: colors.soft, ...bubble(20), paddingHorizontal: 16, paddingVertical: 12, maxWidth: '90%' },
  hintText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  list: { gap: 8 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12, minHeight: 56, borderRadius: 28, backgroundColor: colors.card, paddingLeft: 18, paddingRight: 6, ...shadow },
  inputLead: { fontFamily: fonts.titleBold, fontSize: 16, color: colors.blue },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 16, color: colors.ink, paddingVertical: 10 },
  inputBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  inputQ: { fontFamily: fonts.titleBold, fontSize: 20, color: '#FFFFFF' },
}));
