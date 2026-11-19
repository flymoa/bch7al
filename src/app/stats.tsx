import { Icon } from '@/components/icon';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CountUp, FadeIn, GrowBar } from '@/components/motion';
import { Button, Card, Chip, Empty, Header, RowCard, Screen, Tile, s as ui, t } from '@/components/ui';
import { listMonths, monthRecap, monthStats, weekSpend, type MonthRecap, type MonthStats } from '@/db';
import { currentMonth, money, monthLabel, pct, pctChange, plural, qtyLabel } from '@/format';
import { useSQLiteContext } from '@/sqlite';
import { bubble, bubbleRight, colors, fonts, sheet, useTheme } from '@/theme';
import { radius, space, tabular, type } from '@/tokens';

const RING = 132;
const RR = 54;
const CIRC = 2 * Math.PI * RR;
const RING_W = space.lg;
const BAR_MIN = space.sm;
const BAR_MAX = 76;

export default function Stats() {
  useTheme();
  const db = useSQLiteContext();
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState(currentMonth());
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
        if (alive) {
          setMonths(all);
          setMonth(shown);
          setStats(res);
          setRecap(rec);
          setWeeks(w);
        }
      })();
      return () => {
        alive = false;
      };
    }, [db, month]),
  );

  if (months.length === 0) {
    return (
      <Screen bottomBar="stats">
        <Header title="Ton mois" back={false} />
        <View style={st.pad}>
          <Empty
            title="Pas encore de chiffres"
            text="Ton mois apparaît dès que tu enregistres ta première course."
            action={{ label: 'Nouvelle course', icon: 'add', onPress: () => router.push('/trip/new') }}
          />
        </View>
      </Screen>
    );
  }

  // months are newest first
  const i = months.indexOf(month);
  const older = months[i + 1];
  const newer = i > 0 ? months[i - 1] : undefined;
  const vsPrev = stats ? pctChange(stats.prevTotal, stats.total) : null;
  const maxWeek = Math.max(...weeks, 1);
  const top = stats ? stats.byStore.slice(0, 3) : [];
  const rest = stats ? stats.byStore.slice(3).reduce((a, x) => a + x.total, 0) : 0;
  const shares = rest > 0 ? [...top, { store: 'Autres', total: rest, trips: 0 }] : top;
  // Ring: one arc per store, with a small gap between arcs.
  const ringColors = [colors.blue, colors.ink, colors.accent, colors.barSoft];
  const GAP = shares.length > 1 ? space.xs : 0;
  let at = 0;
  const arcs = shares.map((x, k) => {
    const full = stats && stats.total > 0 ? (x.total / stats.total) * CIRC : 0;
    const arc = { store: x.store, total: x.total, color: ringColors[k], start: at + GAP / 2, len: Math.max(0, full - GAP) };
    at += full;
    return arc;
  });

  return (
    <Screen bottomBar="stats">
      {stats && recap ? (
        <ScrollView contentContainerStyle={st.scroll}>
          <View style={st.top}>
            <Text style={st.h1}>Ton mois</Text>
            <View style={st.switch}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mois précédent"
                accessibilityState={{ disabled: !older }}
                disabled={!older}
                onPress={() => older && setMonth(older)}
                style={[st.arrow, !older && st.off]}
              >
                <Icon name="chevron-back" size={type.title} color={colors.ink} />
              </Pressable>
              <Text style={st.monthName} numberOfLines={1}>{monthLabel(month).replace(/ \d{4}$/, month.slice(0, 4) === currentMonth().slice(0, 4) ? '' : ' ' + month.slice(0, 4))}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mois suivant"
                accessibilityState={{ disabled: !newer }}
                disabled={!newer}
                onPress={() => newer && setMonth(newer)}
                style={[st.arrow, !newer && st.off]}
              >
                <Icon name="chevron-forward" size={type.title} color={colors.ink} />
              </Pressable>
            </View>
          </View>

          <View style={st.content}>
            <FadeIn>
              <View style={st.hero} accessible accessibilityLabel={`${money(stats.total)} DH dépensés`}>
                <View style={st.heroRow}>
                  <CountUp style={st.heroTotal} value={stats.total} format={(v) => money(v).replace(/,00$/, '')} />
                  <Text style={st.heroUnit}>DH</Text>
                </View>
                <Text style={st.heroMeta}>
                  {plural(stats.trips, 'sortie', 'sorties')}
                  {vsPrev !== null ? ` · ${vsPrev >= 0 ? '+' : '−'}${pct(vsPrev)} vs le mois d'avant` : ''}
                </Text>
              </View>
            </FadeIn>
            <FadeIn index={1}>
              <Card style={st.ringCard}>
                <View accessible accessibilityLabel={arcs.map((x) => `${x.store} : ${money(x.total)} DH`).join(', ')}>
                  <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
                    <Circle cx={RING / 2} cy={RING / 2} r={RR} fill="none" stroke={colors.soft} strokeWidth={RING_W} />
                    {arcs.map((x) => (
                      <Circle
                        key={x.store}
                        cx={RING / 2}
                        cy={RING / 2}
                        r={RR}
                        fill="none"
                        stroke={x.color}
                        strokeWidth={RING_W}
                        strokeDasharray={`${x.len} ${CIRC}`}
                        strokeDashoffset={-x.start}
                        transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                      />
                    ))}
                  </Svg>
                </View>
                <View style={st.legendBox}>
                  {arcs.map((x) => (
                    <View key={x.store} style={st.legend}>
                      <View style={[st.dot, { backgroundColor: x.color }]} />
                      <Text style={st.legendName} numberOfLines={1}>{x.store}</Text>
                      <Text style={st.legendValue}>{Math.round(x.total)}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </FadeIn>

            <FadeIn index={2}>
              <Card style={st.block}>
                <View style={st.blockHead}>
                  <Text style={st.title}>Par semaine</Text>
                  {maxWeek > 1 ? <Text style={t.meta}>plus grosse : sem. {weeks.indexOf(maxWeek) + 1}</Text> : null}
                </View>
                <View style={st.weeks} accessible accessibilityLabel={weeks.map((w, k) => `Semaine ${k + 1} : ${money(w)} DH`).join(', ')}>
                  {weeks.map((w, k) => (
                    <View key={k} style={st.week}>
                      <Text style={st.weekValue}>{w > 0 ? Math.round(w) : '–'}</Text>
                      <GrowBar index={k} height={BAR_MIN + (w / maxWeek) * BAR_MAX} color={w === maxWeek && w > 0 ? colors.blue : colors.barSoft} style={st.weekBar} />
                      <Text style={st.weekLabel}>Sem. {k + 1}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </FadeIn>

            {recap.drop || recap.rise ? (
              <View style={st.tiles}>
                {recap.drop ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Bonne surprise : ${recap.drop.name}`} onPress={() => router.push(`/ask?id=${recap.drop!.id}`)} style={({ pressed }) => [st.tile, st.tileBlue, pressed && ui.pressed]}>
                    <Text style={st.tileLabelOn}>Bonne surprise</Text>
                    <Text style={st.tileNameOn} numberOfLines={2}>{recap.drop.name}</Text>
                    <Text style={st.tilePriceOn}>−{pct(recap.drop.change)}</Text>
                    <Text style={st.tileLabelOn}>{money(recap.drop.now)} DH</Text>
                  </Pressable>
                ) : null}
                {recap.rise ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Ce qui a monté : ${recap.rise.name}`} onPress={() => router.push(`/ask?id=${recap.rise!.id}`)} style={({ pressed }) => [st.tile, st.tileLine, pressed && ui.pressed]}>
                    <Text style={st.tileLabel}>Ce qui a monté</Text>
                    <Text style={st.tileName} numberOfLines={2}>{recap.rise.name}</Text>
                    <Text style={st.tilePrice}>+{pct(recap.rise.change)}</Text>
                    <Text style={st.tileLabel}>{money(recap.rise.now)} DH</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={[st.content, st.more]}>
            <Button label="Ton mois en résumé" icon="reader-outline" tone="light" onPress={() => router.push(`/recap?month=${month}`)} />

            <Card style={st.block}>
              <Text style={st.title}>Mes prix ont-ils augmenté ?</Text>
              {stats.inflation === null ? (
                <Text style={t.meta}>
                  Il faut avoir acheté un même produit avant ce mois-ci pour comparer. Continue à noter tes courses, ce chiffre apparaîtra tout seul.
                </Text>
              ) : (
                <>
                  <View style={st.inflRow}>
                    <Text style={st.infl}>
                      {stats.inflation >= 0 ? '+' : '−'}{pct(stats.inflation)}
                    </Text>
                    <Text style={[t.meta, st.flex]}>
                      Variation moyenne de tes prix, comparée à ton achat précédent, sur {plural(stats.compared, 'produit', 'produits')}.
                    </Text>
                  </View>
                  {stats.moves.slice(0, 4).map((m) => (
                    <RowCard key={m.id} label={m.name} onPress={() => router.push(`/product/${m.id}`)}>
                      <Tile text={m.name} size={38} />
                      <View style={st.flex}>
                        <Text style={t.name} numberOfLines={1}>{m.name}</Text>
                        <Text style={t.meta}>
                          {money(m.before)} → {money(m.now)} DH / {m.unit}
                        </Text>
                      </View>
                      {Math.abs(m.change) < 0.05 ? (
                        <Chip label="Même prix" />
                      ) : (
                        <Chip label={pct(m.change)} tone={m.change < 0 ? 'down' : 'up'} icon={m.change < 0 ? 'arrow-down' : 'arrow-up'} />
                      )}
                    </RowCard>
                  ))}
                </>
              )}
            </Card>

            <Card style={st.block}>
              <Text style={st.title}>Là où part ton argent</Text>
              {stats.topProducts.map((p, k) => (
                <RowCard key={p.id} label={p.name} onPress={() => router.push(`/product/${p.id}`)}>
                  <Text style={st.rank}>{k + 1}</Text>
                  <Tile text={p.name} size={38} />
                  <View style={st.flex}>
                    <Text style={t.name} numberOfLines={1}>{p.name}</Text>
                    <Text style={t.meta}>
                      {qtyLabel(p.qty, p.unit)}{p.unit === 'kg' || p.unit === 'L' ? '' : ` ${p.unit}${p.qty > 1 ? 's' : ''}`}
                    </Text>
                  </View>
                  <Text style={t.price}>{money(p.total)}</Text>
                </RowCard>
              ))}
            </Card>

            <View style={st.links}>
              {/* Each button sits in its own half so the two are always the same width. */}
              <View style={st.flex}>
                <Button label="Courses" icon="receipt-outline" tone="light" style={st.linkBtn} onPress={() => router.push('/trips')} />
              </View>
              <View style={st.flex}>
                <Button label="Produits" icon="cube-outline" tone="light" style={st.linkBtn} onPress={() => router.push('/products')} />
              </View>
            </View>
          </View>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const st = sheet(() => ({
  pad: { padding: space.lg },
  flex: { flex: 1, minWidth: 0 },
  scroll: { paddingBottom: space.xl },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.lg },
  h1: { fontFamily: fonts.titleBold, fontSize: type.h1, letterSpacing: -0.6, color: colors.ink },
  switch: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  arrow: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  monthName: { minWidth: 84, maxWidth: 120, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.ink },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md },
  more: { paddingTop: space.md },
  hero: { gap: space.xs, paddingVertical: space.sm },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  heroTotal: { fontFamily: fonts.titleBold, fontSize: type.priceHero, letterSpacing: -1, color: colors.ink, ...tabular },
  heroUnit: { fontFamily: fonts.bodyBold, fontSize: type.bodyLg, color: colors.muted },
  heroMeta: { fontFamily: fonts.body, fontSize: type.body, color: colors.muted },
  ringCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
  legendBox: { flex: 1, gap: space.sm },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: space.md, height: space.md, borderRadius: radius.pill },
  legendName: { flex: 1, fontFamily: fonts.body, fontSize: type.body, color: colors.ink },
  legendValue: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.ink, ...tabular },
  blockHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  weeks: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, minHeight: 122 },
  week: { flex: 1, gap: space.sm },
  weekValue: { fontFamily: fonts.bodyBold, fontSize: type.caption, color: colors.ink, textAlign: 'center', ...tabular },
  weekBar: { borderRadius: radius.md, borderBottomLeftRadius: radius.sm / 2 },
  weekLabel: { fontFamily: fonts.body, fontSize: type.caption, color: colors.muted, textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, minHeight: 112, padding: space.lg, gap: space.xs },
  tileBlue: { backgroundColor: colors.blue, ...bubble(radius.lg) },
  tileLine: { backgroundColor: colors.card, ...bubbleRight(radius.lg), borderWidth: 2, borderColor: colors.upText },
  tileLabelOn: { fontFamily: fonts.bodyBold, fontSize: type.caption, color: colors.white },
  tileNameOn: { fontFamily: fonts.title, fontSize: type.body, color: colors.white },
  tilePriceOn: { fontFamily: fonts.titleBold, fontSize: type.title, color: colors.white, ...tabular },
  tileLabel: { fontFamily: fonts.bodyBold, fontSize: type.caption, color: colors.muted },
  tileName: { fontFamily: fonts.title, fontSize: type.body, color: colors.ink },
  tilePrice: { fontFamily: fonts.titleBold, fontSize: type.title, color: colors.ink, ...tabular },
  block: { gap: space.md, padding: space.lg },
  title: { fontFamily: fonts.title, fontSize: type.bodyLg, color: colors.ink },
  inflRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  infl: { fontFamily: fonts.titleBold, fontSize: type.price, letterSpacing: -0.5, color: colors.ink, ...tabular },
  rank: { fontFamily: fonts.title, fontSize: type.body, color: colors.muted, width: space.lg, textAlign: 'center', ...tabular },
  links: { flexDirection: 'row', gap: space.md },
  linkBtn: { paddingHorizontal: space.md },
}));
