// « bch7al … ? » — the in-shop question. Type a product, see your best price and where,
// then type the price on the shelf and get the verdict: Ghali / Normal / Rkhis.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { FadeIn, Pop } from '@/components/motion';
import { showToast } from '@/components/toast';
import { Bars, Button, Empty, Field, Group, IconButton, Row, Screen, StepChart, Tile, s as ui, t } from '@/components/ui';
import { addListItem, getProduct, listProducts, pricesByStore, productHistory, type HistoryRow, type ProductRow, type StorePrice } from '@/db';
import { basePrice, money, parseNumber, pct, perUnit, plural, ryal, shortDate, verdict } from '@/format';
import { useSQLiteContext } from '@/sqlite';
import { bubble, bubbleRight, colors, price as pc, sheet, text, useTheme } from '@/theme';
import { size, space } from '@/tokens';

export default function Ask() {
  useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductRow[] | null>(null);
  const [picked, setPicked] = useState<ProductRow | null>(null);
  const [where, setWhere] = useState<StorePrice[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [seen, setSeen] = useState('');
  const [chartW, setChartW] = useState(0);

  const pick = async (p: ProductRow) => {
    const [w, h] = await Promise.all([pricesByStore(db, p.id), productHistory(db, p.id)]);
    setWhere(w);
    setHistory(h.slice(-10));
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
    return () => { alive = false; };
  }, [db, query]);

  const usual = picked?.avg_price ?? null;
  const best = where[0] ?? null;
  const seenPrice = parseNumber(seen);
  const v = seen.trim() && seenPrice >= 0 ? verdict(seenPrice, usual) : null;
  const others = where.slice(1);
  const base = picked && best ? basePrice(best.price, picked.unit, picked.name) : null;

  return (
    <Screen>
      <View style={st.top}>
        <IconButton icon="back" label="Retour" tone="surface" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={st.askBox}>
          <Text style={st.askLead}>bch7al</Text>
          <Field
            accessibilityLabel="Nom du produit"
            value={query}
            onChangeText={(x) => { setQuery(x); if (picked) setPicked(null); }}
            placeholder={picked ? 'autre chose…' : "le lait, l'huile…"}
            autoFocus={!params.id}
            autoCorrect={false}
            returnKeyType="search"
            style={st.askField}
          />
          <Text style={st.askQ}>?</Text>
        </View>
      </View>
      <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          {picked ? (
            <>
              <Pop style={st.right}>
                <View style={st.question}><Text style={st.questionText}>bch7al {picked.name} ?</Text></View>
              </Pop>
              <Pop>
                <View style={st.answer} accessible accessibilityLabel={`${money(best?.price ?? picked.last_price ?? 0)} dirhams chez ${best?.store ?? ''}`}>
                  <Text style={st.answerOver}>{where.length > 1 ? 'TON MEILLEUR PRIX' : 'TON DERNIER PRIX'}</Text>
                  <View style={st.answerRow}>
                    <Text style={st.answerPrice} adjustsFontSizeToFit numberOfLines={1}>{money(best?.price ?? picked.last_price ?? 0)}</Text>
                    <Text style={st.answerUnit}>DH{perUnit(picked.unit)}</Text>
                  </View>
                  {best ? <Text style={st.answerMeta}>chez <Text style={st.strong}>{best.store}</Text> · le {shortDate(best.date)}</Text> : null}
                  <Text style={st.answerSmall}>
                    D'habitude {money(usual ?? 0)} DH · {plural(picked.n, 'achat', 'achats')}
                    {base && picked.unit !== base.base ? ` · ${money(base.price)} DH/${base.base}` : ''}
                    {picked.unit === 'kg' && best ? ` · ${ryal(best.price)}` : ''}
                  </Text>
                </View>
              </Pop>

              <View style={st.card}>
                <Text style={st.cardTitle}>Tu vois un prix en magasin ?</Text>
                <View style={st.seenRow}>
                  <Field big onCard accessibilityLabel={`Prix vu en dirhams${perUnit(picked.unit)}`} value={seen} onChangeText={setSeen} placeholder="0,00" keyboardType="decimal-pad" style={ui.flex} />
                  <Text style={st.mad}>DH{perUnit(picked.unit)}</Text>
                </View>
                {v ? (
                  <Pop>
                    <View
                      style={[st.verdict, { backgroundColor: v.kind === 'high' ? pc.upBg : v.kind === 'good' ? pc.downBg : pc.sameBg }]}
                      accessibilityLiveRegion="polite"
                    >
                      <View style={st.verdictHead}>
                        <Icon name={v.kind === 'high' ? 'up' : v.kind === 'good' ? 'down' : 'same'} weight="bold" color={v.kind === 'high' ? pc.upFg : v.kind === 'good' ? pc.downFg : pc.sameFg} />
                        <Text style={[st.verdictWord, { color: v.kind === 'high' ? pc.upFg : v.kind === 'good' ? pc.downFg : colors.ink }]}>
                          {v.kind === 'good' ? 'Rkhis, chri !' : v.kind === 'high' ? 'Ghali' : 'Normal'}
                        </Text>
                      </View>
                      <Text style={[st.verdictText, { color: v.kind === 'high' ? pc.upFg : v.kind === 'good' ? pc.downFg : pc.sameFg }]}>
                        {v.kind === 'normal'
                          ? `À peu près ce que tu paies d'habitude (${money(usual ?? 0)} DH).`
                          : `${v.change < 0 ? '−' : '+'}${pct(v.change)} : ${v.change < 0 ? 'moins' : 'plus'} cher que d'habitude (${money(usual ?? 0)} DH).`}
                        {best && seenPrice > best.price + 0.005 ? ` Tu l'as eu à ${money(best.price)} chez ${best.store}.` : ''}
                        {` · ${plural(picked.n, 'achat', 'achats')}`}
                      </Text>
                    </View>
                  </Pop>
                ) : (
                  <Text style={t.body}>Écris le prix affiché : je te dis si c'est rkhis ou ghali.</Text>
                )}
              </View>

              {others.length > 0 ? (
                <FadeIn index={1}>
                  <View style={st.card}>
                    <Text style={st.cardTitle}>Ailleurs</Text>
                    <Bars rows={others.map((w) => ({ key: w.store, label: w.store, value: w.price, meta: `le ${shortDate(w.date)}` }))} />
                  </View>
                </FadeIn>
              ) : null}

              {history.length > 1 ? (
                <FadeIn index={2}>
                  <View style={st.card} onLayout={(e) => setChartW(Math.round(e.nativeEvent.layout.width) - space.lg * 2)}>
                    <Text style={st.cardTitle}>Depuis le {shortDate(history[0].date)}</Text>
                    <StepChart width={chartW} height={110} points={history.map((h) => ({ v: h.unit_price, promo: !!h.promo }))} usual={usual} />
                  </View>
                </FadeIn>
              ) : null}

              <View style={st.actions}>
                <Button kind="tonal" icon="list" label="À ma liste" compact style={ui.flex} onPress={async () => showToast((await addListItem(db, picked.name)) ? 'Ajouté à ta liste' : 'Déjà dans ta liste')} />
                <Button kind="outline" icon="products" label="Historique" compact style={ui.flex} onPress={() => router.push(`/product/${picked.id}`)} />
              </View>
            </>
          ) : results && results.length === 0 ? (
            <Empty
              icon="search"
              title={query.trim() ? `Pas encore de prix pour « ${query.trim()} »` : 'Aucun prix noté pour le moment'}
              text="Note-le dans une course : la prochaine fois, je te dirai combien tu le paies."
            />
          ) : results ? (
            <>
              <Text style={[t.label, st.hint]}>{query.trim() ? 'TOUCHE UN PRODUIT' : 'TES PRODUITS HABITUELS'}</Text>
              <Group>
                {results.map((p, i) => (
                  <Row key={p.id} first={i === 0} label={p.name} onPress={() => pick(p)} leading={<Tile text={p.name} />} title={p.name} meta={plural(p.n, 'achat', 'achats')} price={money(p.last_price ?? 0)} unit={`DH${perUnit(p.unit)}`} />
                ))}
              </Group>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = sheet(() => ({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md },
  askBox: { flex: 1, flexDirection: 'row', alignItems: 'center', ...bubble('lg'), backgroundColor: colors.surfaceContainer, paddingLeft: space.lg, paddingRight: space.lg, minHeight: 56 },
  askLead: { ...text('title'), color: colors.ink },
  askField: { flex: 1, backgroundColor: 'transparent', borderWidth: 0, minHeight: 52, paddingHorizontal: space.sm },
  askQ: { ...text('headlineSm'), color: colors.primary },
  content: { paddingHorizontal: size.screen, paddingBottom: space.section, gap: space.md },
  right: { alignSelf: 'flex-end', maxWidth: '86%' },
  question: { backgroundColor: colors.primary, ...bubbleRight('lg'), paddingHorizontal: space.lg, paddingVertical: space.md },
  questionText: { ...text('title'), color: colors.onPrimary },
  answer: { backgroundColor: colors.hero, ...bubble('hero'), padding: space.xxl, gap: space.xs },
  answerOver: { ...text('overline'), color: colors.onHeroMuted },
  answerRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  answerPrice: { ...text('priceHero'), color: colors.onHero, flexShrink: 1 },
  answerUnit: { ...text('title'), color: colors.onHeroMuted },
  answerMeta: { ...text('body'), color: colors.onHero },
  answerSmall: { ...text('caption'), color: colors.onHeroMuted },
  strong: { fontFamily: text('title').fontFamily },
  card: { backgroundColor: colors.surfaceContainer, ...bubble('lg'), padding: space.lg, gap: space.md },
  cardTitle: { ...text('title'), color: colors.ink },
  seenRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mad: { ...text('title'), color: colors.muted },
  verdict: { ...bubble('sm'), padding: space.lg, gap: space.xs },
  verdictHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  verdictWord: { ...text('headlineSm') },
  verdictText: { ...text('bodySm') },
  actions: { flexDirection: 'row', gap: space.sm },
  hint: { paddingHorizontal: space.xs, paddingTop: space.sm },
}));
