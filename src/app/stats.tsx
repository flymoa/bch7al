import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CountUp, FadeIn, GrowBar } from '@/components/motion';
import { Button, Card, Chip, Empty, Header, RowCard, Screen, Tile, s as ui, t } from '@/components/ui';
import { listMonths, monthRecap, monthStats, weekSpend, type MonthRecap, type MonthStats } from '@/db';
import { currentMonth, money, monthLabel, pct, pctChange, plural } from '@/format';
import { useSQLiteContext } from '@/sqlite';
import { colors, fonts, sheet, useTheme } from '@/theme';

const SHARE = ['#FFFFFF', '#A9BCFF', '#4D6FFF', '#2A3F8C'];

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

  return (
    <Screen bottomBar="stats" night>
      {stats && recap ? (
        <ScrollView contentContainerStyle={st.scroll}>
          <View style={st.night}>
            <View style={st.top}>
              <Text style={st.topLabel}>Ton mois</Text>
              <View style={st.switch}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mois précédent"
                  accessibilityState={{ disabled: !older }}
                  disabled={!older}
                  onPress={() => older && setMonth(older)}
                  style={[st.arrow, !older && st.off]}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.white} />
                </Pressable>
                <Text style={st.monthName} numberOfLines={1}>{monthLabel(month)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mois suivant"
                  accessibilityState={{ disabled: !newer }}
                  disabled={!newer}
                  onPress={() => newer && setMonth(newer)}
                  style={[st.arrow, !newer && st.off]}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.white} />
                </Pressable>
              </View>
            </View>

            <FadeIn>
              <View style={st.totalRow}>
                <CountUp style={st.total} value={stats.total} format={(v) => money(v).replace(/,00$/, '')} />
                <Text style={st.totalUnit}>MAD</Text>
              </View>
              <Text style={st.meta}>
                {plural(stats.trips, 'sortie', 'sorties')} · {plural(recap.items, 'article', 'articles')}
                {vsPrev !== null ? ` · ${vsPrev >= 0 ? '+' : '−'}${pct(vsPrev)} vs le mois d'avant` : ''}
              </Text>
            </FadeIn>

            <View style={st.weeks} accessible accessibilityLabel={weeks.map((w, k) => `Semaine ${k + 1} : ${money(w)} MAD`).join(', ')}>
              {weeks.map((w, k) => (
                <View key={k} style={st.week}>
                  <Text style={st.weekValue}>{w > 0 ? Math.round(w) : '–'}</Text>
                  <GrowBar index={k} height={12 + (w / maxWeek) * 84} color={w === maxWeek && w > 0 ? colors.white : colors.nightBlue} style={st.weekBar} />
                  <Text style={st.weekLabel}>Sem. {k + 1}</Text>
                </View>
              ))}
            </View>

            {shares.length > 0 && stats.total > 0 ? (
              <View style={st.where}>
                <Text style={st.whereTitle}>Où c'est parti</Text>
                <View style={st.shareBar} accessible accessibilityLabel={shares.map((x) => `${x.store} ${Math.round((x.total / stats.total) * 100)} %`).join(', ')}>
                  {shares.map((x, k) => (
                    <View key={x.store} style={[st.share, { flex: x.total, backgroundColor: SHARE[k] }]} />
                  ))}
                </View>
                {shares.map((x, k) => (
                  <View key={x.store} style={st.legend}>
                    <View style={[st.dot, { backgroundColor: SHARE[k] }]} />
                    <Text style={st.legendName} numberOfLines={1}>{x.store}</Text>
                    <Text style={st.legendValue}>{money(x.total).replace(/,00$/, '')} MAD</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {recap.drop || recap.rise ? (
              <View style={st.tiles}>
                {recap.drop ? (
                  <Pressable accessibilityRole="button" onPress={() => router.push(`/ask?id=${recap.drop!.id}`)} style={({ pressed }) => [st.tile, st.tileBlue, pressed && ui.pressed]}>
                    <Text style={st.tileLabelOn}>La bonne surprise</Text>
                    <Text style={st.tileNameOn} numberOfLines={2}>{recap.drop.name}</Text>
                    <Text style={st.tileTextOn}>−{pct(recap.drop.change)} · {money(recap.drop.now)} MAD</Text>
                  </Pressable>
                ) : null}
                {recap.rise ? (
                  <Pressable accessibilityRole="button" onPress={() => router.push(`/ask?id=${recap.rise!.id}`)} style={({ pressed }) => [st.tile, st.tileWhite, pressed && ui.pressed]}>
                    <Text style={st.tileLabel}>Ce qui a monté</Text>
                    <Text style={st.tileName} numberOfLines={2}>{recap.rise.name}</Text>
                    <Text style={st.tileText}>+{pct(recap.rise.change)} · {money(recap.rise.now)} MAD</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={st.content}>
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
                          {money(m.before)} → {money(m.now)} MAD / {m.unit}
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
              <Button label="Mes courses" icon="receipt-outline" tone="light" style={st.flex} onPress={() => router.push('/trips')} />
              <Button label="Mes produits" icon="cube-outline" tone="light" style={st.flex} onPress={() => router.push('/products')} />
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
  night: { backgroundColor: colors.night, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, gap: 18 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLabel: { fontFamily: fonts.title, fontSize: 17, color: colors.onNight },
  switch: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  arrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.nightSoft, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  monthName: { minWidth: 96, maxWidth: 140, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  total: { fontFamily: fonts.titleBold, fontSize: 80, lineHeight: 92, letterSpacing: -3, color: colors.white },
  totalUnit: { fontFamily: fonts.title, fontSize: 22, color: colors.onNight },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.onNight },
  weeks: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, minHeight: 140 },
  week: { flex: 1, gap: 6 },
  weekValue: { fontFamily: fonts.title, fontSize: 15, color: colors.white, textAlign: 'center' },
  weekBar: { borderRadius: 14 },
  weekLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.onNight, textAlign: 'center' },
  where: { backgroundColor: colors.nightSoft, borderRadius: 24, padding: 16, gap: 10 },
  whereTitle: { fontFamily: fonts.title, fontSize: 17, color: colors.white },
  shareBar: { flexDirection: 'row', gap: 4, height: 16 },
  share: { borderRadius: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  legendValue: { fontFamily: fonts.title, fontSize: 14, color: colors.white },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, minHeight: 116, borderRadius: 24, padding: 16, gap: 4 },
  tileBlue: { backgroundColor: '#1F4BFF' },
  tileWhite: { backgroundColor: '#FFFFFF' },
  tileLabelOn: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#FFFFFF' },
  tileNameOn: { fontFamily: fonts.title, fontSize: 17, color: '#FFFFFF' },
  tileTextOn: { fontFamily: fonts.body, fontSize: 13, color: '#FFFFFF' },
  tileLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#46557F' },
  tileName: { fontFamily: fonts.title, fontSize: 17, color: '#0B1B4D' },
  tileText: { fontFamily: fonts.body, fontSize: 13, color: '#0B1B4D' },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  block: { gap: 10, padding: 16 },
  title: { fontFamily: fonts.title, fontSize: 18, color: colors.ink },
  inflRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infl: { fontFamily: fonts.titleBold, fontSize: 34, color: colors.ink },
  rank: { fontFamily: fonts.title, fontSize: 16, color: colors.muted, width: 16, textAlign: 'center' },
  links: { flexDirection: 'row', gap: 10 },
}));
