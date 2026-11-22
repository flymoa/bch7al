// Mois (tab) — « Ton mois »: the total, why it moved (prices vs quantities), what rose and
// fell, where the money went (ranked bars, never a donut) and your own inflation.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CountUp, FadeIn } from '@/components/motion';
import { Bars, ChangeChip, Empty, Group, IconButton, PriceChip, Row, Screen, ScreenTitle, SectionHeader, Tile, openNewTrip, s as ui, t } from '@/components/ui';
import { listMonths, monthRecap, monthStats, weekSpend, type MonthRecap, type MonthStats } from '@/db';
import { currentMonth, money, moneyShort, monthLabel, pct, pctChange, plural, qtyLabel } from '@/format';
import { useSQLiteContext } from '@/sqlite';
import { bubble, colors, price as pc, sheet, text, useTheme } from '@/theme';
import { radius, size, space } from '@/tokens';

const WEEK_MAX = 72;

export default function Month() {
  useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ month?: string }>();
  const [months, setMonths] = useState<string[] | null>(null);
  const [month, setMonth] = useState(params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonth());
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [recap, setRecap] = useState<MonthRecap | null>(null);
  const [weeks, setWeeks] = useState<number[]>([0, 0, 0, 0]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const all = await listMonths(db);
        const shown = all.includes(month) || all.length === 0 ? month : all[0];
        const [res, rec, w] = await Promise.all([monthStats(db, shown), monthRecap(db, shown), weekSpend(db, shown)]);
        if (!alive) return;
        setMonths(all);
        setMonth(shown);
        setStats(res);
        setRecap(rec);
        setWeeks(w);
      })();
      return () => { alive = false; };
    }, [db, month]),
  );

  if (months && months.length === 0) {
    return (
      <Screen tab="month">
        <ScreenTitle title="Ton mois" />
        <View style={st.pad}>
          <Empty icon="month" darija="Mazal ma kayn walou" title="Pas encore de chiffres" text="Ton mois apparaît dès ta première course : total, ce qui a monté, et où ton argent est parti." action={{ label: 'Nouvelle course', icon: 'plus', onPress: () => openNewTrip('manual') }} />
        </View>
      </Screen>
    );
  }
  if (!stats || !recap || !months) return <Screen tab="month"><ScreenTitle title="Ton mois" /></Screen>;

  const i = months.indexOf(month);
  const older = months[i + 1];
  const newer = i > 0 ? months[i - 1] : undefined;
  const vsPrev = pctChange(stats.prevTotal, stats.total);
  const diff = stats.total - stats.prevTotal;
  const prevName = monthLabel(older ?? month).replace(/ \d{4}$/, '').toLowerCase();
  const maxWeek = Math.max(...weeks, 1);
  const year = month.slice(0, 4) === currentMonth().slice(0, 4) ? '' : ' ' + month.slice(0, 4);

  return (
    <Screen tab="month">
      <ScreenTitle
        title="Ton mois"
        meta={monthLabel(month).replace(/ \d{4}$/, '') + year}
        right={
          <View style={st.switch}>
            <IconButton icon="back" label="Mois précédent" tone="surface" disabled={!older} onPress={() => older && setMonth(older)} />
            <IconButton icon="next" label="Mois suivant" tone="surface" disabled={!newer} onPress={() => newer && setMonth(newer)} />
          </View>
        }
      />
      <ScrollView contentContainerStyle={st.content}>
        <FadeIn>
          <View style={st.hero} accessible accessibilityLabel={`${money(stats.total)} dirhams dépensés`}>
            <View style={st.heroRow}>
              <CountUp style={st.heroTotal} value={stats.total} format={moneyShort} />
              <Text style={st.heroUnit}>DH</Text>
            </View>
            <View style={st.heroMeta}>
              <Text style={st.heroText}>{plural(stats.trips, 'course', 'courses')} · {plural(recap.items, 'article', 'articles')}</Text>
              {vsPrev !== null && stats.prevTotal > 0 ? <PriceChip onHero dir={Math.abs(vsPrev) < 0.5 ? 'same' : vsPrev > 0 ? 'up' : 'down'} label={`${vsPrev >= 0 ? '+' : '−'}${pct(vsPrev)} vs ${prevName}`} /> : null}
            </View>
            {stats.prevTotal > 0 && stats.compared > 0 && Math.abs(diff) >= 1 ? (
              <View style={st.split}>
                <Text style={st.splitTitle}>{diff >= 0 ? '+' : '−'}{moneyShort(Math.abs(diff))} DH vs {prevName}, dont :</Text>
                <SplitLine label="à cause des prix" value={stats.priceEffect} />
                <SplitLine label="parce que tu as acheté plus ou moins" value={diff - stats.priceEffect} />
              </View>
            ) : null}
          </View>
        </FadeIn>

        {recap.drop || recap.rise ? (
          <View style={st.tiles}>
            {recap.rise ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Ce qui a monté : ${recap.rise.name}`} onPress={() => router.push(`/product/${recap.rise!.id}`)} style={({ pressed }) => [st.tile, { backgroundColor: pc.upBg }, pressed && ui.pressedSoft]}>
                <Text style={[st.tileOver, { color: pc.upFg }]}>CE QUI A MONTÉ</Text>
                <Text style={[st.tileName, { color: pc.upFg }]} numberOfLines={2}>{recap.rise.name}</Text>
                <Text style={[st.tileNum, { color: pc.upFg }]}>▲ +{pct(recap.rise.change)}</Text>
                <Text style={[st.tileMeta, { color: pc.upFg }]}>{money(recap.rise.before)} → {money(recap.rise.now)} DH</Text>
              </Pressable>
            ) : null}
            {recap.drop ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Bonne surprise : ${recap.drop.name}`} onPress={() => router.push(`/product/${recap.drop!.id}`)} style={({ pressed }) => [st.tile, { backgroundColor: pc.downBg }, pressed && ui.pressedSoft]}>
                <Text style={[st.tileOver, { color: pc.downFg }]}>BONNE SURPRISE</Text>
                <Text style={[st.tileName, { color: pc.downFg }]} numberOfLines={2}>{recap.drop.name}</Text>
                <Text style={[st.tileNum, { color: pc.downFg }]}>▼ −{pct(recap.drop.change)}</Text>
                <Text style={[st.tileMeta, { color: pc.downFg }]}>{money(recap.drop.before)} → {money(recap.drop.now)} DH</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <SectionHeader title="Ton inflation" />
        {stats.inflation === null ? (
          <Text style={[t.body, st.sub]}>Il faut avoir acheté un même produit avant ce mois-ci pour comparer. Continue à noter tes courses : ce chiffre apparaîtra tout seul.</Text>
        ) : (
          <>
            <View style={st.infl}>
              <Text style={st.inflNum}>{stats.inflation >= 0 ? '+' : '−'}{pct(stats.inflation)}</Text>
              <Text style={[t.body, ui.flex]}>Variation moyenne de tes prix par rapport à ton achat précédent, sur {plural(stats.compared, 'produit', 'produits')}.</Text>
            </View>
            {stats.moves.length > 0 ? (
              <Group>
                {stats.moves.slice(0, 4).map((m, k) => (
                  <Row key={m.id} first={k === 0} label={m.name} onPress={() => router.push(`/product/${m.id}`)} leading={<Tile text={m.name} />} title={m.name} meta={`avant ${money(m.before)} DH`} price={money(m.now)} unit="DH" chip={<ChangeChip from={m.before} to={m.now} />} />
                ))}
              </Group>
            ) : null}
          </>
        )}

        <SectionHeader title="Par magasin" />
        <View style={st.card}>
          <Bars rows={stats.byStore.map((x) => ({ key: x.store, label: x.store, value: x.total, meta: plural(x.trips, 'course', 'courses') }))} />
          {recap.bestStore ? (
            <Text style={t.body}><Text style={st.strong}>{recap.bestStore.store}</Text> t'a fait garder environ {money(recap.bestStore.saved)} DH par rapport aux mêmes produits ailleurs.</Text>
          ) : null}
        </View>

        <SectionHeader title="Par semaine" />
        <View style={[st.card, st.weeks]} accessible accessibilityLabel={weeks.map((w, k) => `Semaine ${k + 1} : ${money(w)} DH`).join(', ')}>
          {weeks.map((w, k) => (
            <View key={k} style={st.week}>
              <Text style={st.weekValue}>{w > 0 ? moneyShort(Math.round(w)) : '–'}</Text>
              <View style={[st.weekBar, { height: space.xs + (w / maxWeek) * WEEK_MAX, backgroundColor: w === maxWeek && w > 0 ? colors.primary : colors.primaryContainer }]} />
              <Text style={t.meta}>Sem. {k + 1}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Là où part ton argent" />
        <Group>
          {stats.topProducts.map((p, k) => (
            <Row key={p.id} first={k === 0} label={p.name} onPress={() => router.push(`/product/${p.id}`)} leading={<Tile text={p.name} />} title={p.name} meta={`${qtyLabel(p.qty, p.unit)}${p.unit === 'kg' || p.unit === 'L' ? '' : ` ${p.unit}${p.qty > 1 ? 's' : ''}`}`} price={money(p.total)} unit="DH" />
          ))}
        </Group>

        <Group style={st.gap}>
          <Row first label="Toutes les courses" onPress={() => router.push('/trips')} leading={<Tile text="" icon="receipt" />} title="Toutes les courses" meta="par mois, à modifier ou supprimer" />
        </Group>
      </ScrollView>
    </Screen>
  );
}

function SplitLine({ label, value }: { label: string; value: number }) {
  const dir = Math.abs(value) < 0.5 ? 'same' : value > 0 ? 'up' : 'down';
  return (
    <View style={st.splitLine}>
      <PriceChip onHero dir={dir} label={`${value >= 0 ? '+' : '−'}${moneyShort(Math.round(Math.abs(value)))} DH`} />
      <Text style={st.heroText}>{label}</Text>
    </View>
  );
}

const st = sheet(() => ({
  pad: { paddingHorizontal: size.screen },
  content: { paddingHorizontal: size.screen, paddingBottom: space.section, gap: space.md },
  switch: { flexDirection: 'row', gap: space.sm },
  hero: { backgroundColor: colors.hero, ...bubble('hero'), padding: space.xxl, gap: space.sm },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  heroTotal: { ...text('priceHero'), color: colors.onHero },
  heroUnit: { ...text('title'), color: colors.onHeroMuted },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  heroText: { ...text('bodySm'), color: colors.onHeroMuted, flexShrink: 1 },
  split: { gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.heroRaised },
  splitTitle: { ...text('titleSm'), color: colors.onHero },
  splitLine: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, ...bubble('lg'), padding: space.lg, gap: space.xs, minHeight: 148 },
  tileOver: { ...text('overline') },
  tileName: { ...text('title') },
  tileNum: { ...text('headlineSm'), marginTop: 'auto' },
  tileMeta: { ...text('caption') },
  sub: { paddingHorizontal: space.xs },
  infl: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.xs },
  inflNum: { ...text('display'), color: colors.ink },
  card: { backgroundColor: colors.surfaceContainer, borderRadius: radius.card, padding: space.lg, gap: space.lg },
  strong: { fontFamily: text('title').fontFamily, color: colors.ink },
  weeks: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  week: { flex: 1, alignItems: 'center', gap: space.xs },
  weekValue: { ...text('priceUnit'), color: colors.ink },
  weekBar: { width: '70%', borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  gap: { marginTop: space.section },
}));
