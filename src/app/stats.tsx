import { Icon } from '@/components/icon';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CountUp, FadeIn, GrowBar } from '@/components/motion';
import { Button, Card, Chip, Empty, Header, RowCard, Screen, Tile, s as ui, t } from '@/components/ui';
import { listMonths, monthRecap, monthStats, weekSpend, type MonthRecap, type MonthStats } from '@/db';
import { currentMonth, money, monthLabel, pct, pctChange, plural } from '@/format';
import { useSQLiteContext } from '@/sqlite';
import { bubble, bubbleRight, colors, fonts, sheet, useTheme } from '@/theme';

const RING = 132;
const RR = 54;
const CIRC = 2 * Math.PI * RR;

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
          <Empty title="Pas encore de chiffres" text="Ton mois apparaît dès que tu enregistres ta première course." />
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
  const ringColors = [colors.blue, colors.ink, '#9C9AFF', colors.barSoft];
  const GAP = shares.length > 1 ? 5 : 0;
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
                <Icon name="chevron-back" size={20} color={colors.ink} />
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
                <Icon name="chevron-forward" size={20} color={colors.ink} />
              </Pressable>
            </View>
          </View>

          <View style={st.content}>
            <FadeIn>
              <Card style={st.ringCard}>
                <View accessible accessibilityLabel={`${money(stats.total)} DH dépensés`}>
                  <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
                    <Circle cx={RING / 2} cy={RING / 2} r={RR} fill="none" stroke={colors.soft} strokeWidth={16} />
                    {arcs.map((x) => (
                      <Circle
                        key={x.store}
                        cx={RING / 2}
                        cy={RING / 2}
                        r={RR}
                        fill="none"
                        stroke={x.color}
                        strokeWidth={16}
                        strokeDasharray={`${x.len} ${CIRC}`}
                        strokeDashoffset={-x.start}
                        transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                      />
                    ))}
                  </Svg>
                  <View style={st.ringCenter} pointerEvents="none">
                    <CountUp style={st.ringTotal} value={stats.total} format={(v) => money(v).replace(/,00$/, '')} />
                    <Text style={st.ringUnit}>DH</Text>
                  </View>
                </View>
                <View style={st.legendBox}>
                  {arcs.map((x) => (
                    <View key={x.store} style={st.legend}>
                      <View style={[st.dot, { backgroundColor: x.color }]} />
                      <Text style={st.legendName} numberOfLines={1}>{x.store}</Text>
                      <Text style={st.legendValue}>{Math.round(x.total)}</Text>
                    </View>
                  ))}
                  <Text style={st.ringMeta}>
                    {plural(stats.trips, 'sortie', 'sorties')}
                    {vsPrev !== null ? ` · ${vsPrev >= 0 ? '+' : '−'}${pct(vsPrev)} vs le mois d'avant` : ''}
                  </Text>
                </View>
              </Card>
            </FadeIn>

            <FadeIn index={1}>
              <Card style={st.block}>
                <View style={st.blockHead}>
                  <Text style={st.title}>Par semaine</Text>
                  {maxWeek > 1 ? <Text style={t.meta}>plus grosse : sem. {weeks.indexOf(maxWeek) + 1}</Text> : null}
                </View>
                <View style={st.weeks} accessible accessibilityLabel={weeks.map((w, k) => `Semaine ${k + 1} : ${money(w)} DH`).join(', ')}>
                  {weeks.map((w, k) => (
                    <View key={k} style={st.week}>
                      <Text style={st.weekValue}>{w > 0 ? Math.round(w) : '–'}</Text>
                      <GrowBar index={k} height={8 + (w / maxWeek) * 76} color={w === maxWeek && w > 0 ? colors.blue : colors.barSoft} style={st.weekBar} />
                      <Text style={st.weekLabel}>Sem. {k + 1}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </FadeIn>

            {recap.drop || recap.rise ? (
              <View style={st.tiles}>
                {recap.drop ? (
                  <Pressable accessibilityRole="button" onPress={() => router.push(`/ask?id=${recap.drop!.id}`)} style={({ pressed }) => [st.tile, st.tileBlue, pressed && ui.pressed]}>
                    <Text style={st.tileLabelOn}>Bonne surprise</Text>
                    <Text style={st.tileNameOn} numberOfLines={2}>{recap.drop.name}</Text>
                    <Text style={st.tileTextOn}>−{pct(recap.drop.change)} · {money(recap.drop.now)} DH</Text>
                  </Pressable>
                ) : null}
                {recap.rise ? (
                  <Pressable accessibilityRole="button" onPress={() => router.push(`/ask?id=${recap.rise!.id}`)} style={({ pressed }) => [st.tile, st.tileLine, pressed && ui.pressed]}>
                    <Text style={st.tileLabel}>Ce qui a monté</Text>
                    <Text style={st.tileName} numberOfLines={2}>{recap.rise.name}</Text>
                    <Text style={st.tileText}>+{pct(recap.rise.change)} · {money(recap.rise.now)} DH</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={[st.content, st.more]}>
            <Button label="Ton mois en résumé" icon="sparkles-outline" tone="light" onPress={() => router.push(`/recap?month=${month}`)} />

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
                      {String(Math.round(p.qty * 100) / 100).replace('.', ',')} {p.unit}
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
  pad: { padding: 16 },
  flex: { flex: 1, minWidth: 0 },
  scroll: { paddingBottom: 24 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16 },
  h1: { fontFamily: fonts.titleBold, fontSize: 28, letterSpacing: -0.6, color: colors.ink },
  switch: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  arrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  monthName: { minWidth: 84, maxWidth: 120, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  content: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },
  more: { paddingTop: 12 },
  ringCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18 },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringTotal: { fontFamily: fonts.titleBold, fontSize: 24, color: colors.ink },
  ringUnit: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  legendBox: { flex: 1, gap: 9 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  legendValue: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  ringMeta: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted },
  blockHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  weeks: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, minHeight: 122 },
  week: { flex: 1, gap: 6 },
  weekValue: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink, textAlign: 'center' },
  weekBar: { borderRadius: 14, borderBottomLeftRadius: 5 },
  weekLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, minHeight: 112, padding: 16, gap: 4 },
  tileBlue: { backgroundColor: colors.blue, ...bubble(24) },
  tileLine: { backgroundColor: colors.card, ...bubbleRight(24), borderWidth: 2, borderColor: colors.upText },
  tileLabelOn: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.onBlue },
  tileNameOn: { fontFamily: fonts.title, fontSize: 17, color: '#FFFFFF', marginTop: 4 },
  tileTextOn: { fontFamily: fonts.body, fontSize: 13, color: '#FFFFFF' },
  tileLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted },
  tileName: { fontFamily: fonts.title, fontSize: 17, color: colors.ink, marginTop: 4 },
  tileText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  block: { gap: 10, padding: 16 },
  title: { fontFamily: fonts.title, fontSize: 16, color: colors.ink },
  inflRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infl: { fontFamily: fonts.titleBold, fontSize: 30, letterSpacing: -0.5, color: colors.ink },
  rank: { fontFamily: fonts.title, fontSize: 16, color: colors.muted, width: 16, textAlign: 'center' },
  links: { flexDirection: 'row', gap: 10 },
  linkBtn: { paddingHorizontal: 12 },
}));
