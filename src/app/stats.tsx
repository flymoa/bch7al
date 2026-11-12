import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CountUp, FadeIn, GrowBar } from '@/components/motion';
import { Card, Chip, Empty, Header, Pill, RowCard, Screen, Tile, t } from '@/components/ui';
import { listMonths, monthStats, type MonthStats } from '@/db';
import { currentMonth, money, monthLabel, pct, pctChange, plural } from '@/format';
import { useSQLiteContext } from '@/sqlite';
import { colors, fonts, sheet, useTheme } from '@/theme';

export default function Stats() {
  useTheme();
  const db = useSQLiteContext();
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [stats, setStats] = useState<MonthStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const all = await listMonths(db);
        const shown = all.includes(month) || all.length === 0 ? month : all[0];
        const res = await monthStats(db, shown);
        if (alive) {
          setMonths(all);
          setMonth(shown);
          setStats(res);
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
        <Header title="Statistiques" back={false} />
        <View style={st.pad}>
          <Empty title="Pas encore de chiffres" text="Les statistiques apparaissent dès que tu enregistres ta première course." />
        </View>
      </Screen>
    );
  }

  const vsPrev = stats ? pctChange(stats.prevTotal, stats.total) : null;
  const maxStore = stats?.byStore[0]?.total ?? 1;

  return (
    <Screen bottomBar="stats">
      <Header title="Statistiques" back={false} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.months}>
          {months.map((m) => (
            <Pill key={m} label={monthLabel(m)} active={m === month} onPress={() => setMonth(m)} />
          ))}
        </ScrollView>
      </View>
      {stats ? (
        <ScrollView contentContainerStyle={st.content}>
          <FadeIn>
            <View style={st.hero}>
              <Text style={st.heroMeta}>
                Dépensé en {monthLabel(month).toLowerCase()} · {plural(stats.trips, 'course', 'courses')}
              </Text>
              <View style={st.heroRow}>
                <CountUp style={st.heroTotal} value={stats.total} format={money} />
                <Text style={st.heroUnit}>MAD</Text>
              </View>
              {vsPrev !== null ? (
                <Text style={st.heroMeta}>
                  {vsPrev >= 0 ? '+' : '−'}{pct(vsPrev)} par rapport au mois d'avant ({money(stats.prevTotal)} MAD)
                </Text>
              ) : null}
            </View>
          </FadeIn>

          <FadeIn index={1}>
            <Card style={st.block}>
              <Text style={st.title}>Mes prix ont-ils augmenté ?</Text>
              {stats.inflation === null ? (
                <Text style={t.meta}>
                  Il faut avoir acheté un même produit avant ce mois-ci pour comparer. Continue à noter tes courses, ce chiffre apparaîtra tout seul.
                </Text>
              ) : (
                <>
                  <View style={st.inflRow}>
                    <Text style={[st.infl, { color: stats.inflation > 0.05 ? colors.upText : colors.softText }]}>
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
          </FadeIn>

          <FadeIn index={2}>
            <Card style={st.block}>
              <Text style={st.title}>Par magasin</Text>
              {stats.byStore.length === 0 ? <Text style={t.meta}>Aucune course ce mois-ci.</Text> : null}
              {stats.byStore.map((s, i) => (
                <View key={s.store} style={st.storeRow}>
                  <Tile kind="store" text={s.store} size={34} />
                  <View style={st.flex}>
                    <View style={st.storeHead}>
                      <Text style={t.name} numberOfLines={1}>{s.store}</Text>
                      <Text style={t.price}>{money(s.total)}</Text>
                    </View>
                    <View style={st.track}>
                      <GrowBarH index={i} ratio={s.total / maxStore} />
                    </View>
                    <Text style={t.meta}>
                      {plural(s.trips, 'course', 'courses')} · {Math.round((s.total / stats.total) * 100)} % du mois
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </FadeIn>

          <FadeIn index={3}>
            <Card style={st.block}>
              <Text style={st.title}>Là où part ton argent</Text>
              {stats.topProducts.map((p, i) => (
                <RowCard key={p.id} label={p.name} onPress={() => router.push(`/product/${p.id}`)}>
                  <Text style={st.rank}>{i + 1}</Text>
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
          </FadeIn>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

/** Horizontal bar that grows from the left. */
function GrowBarH({ ratio, index }: { ratio: number; index: number }) {
  return (
    <View style={st.barRow}>
      <View style={{ flex: Math.max(ratio, 0.02) }}>
        <GrowBar index={index} height={10} color={colors.blue} style={st.barFill} />
      </View>
      <View style={{ flex: Math.max(1 - ratio, 0) }} />
    </View>
  );
}

const st = sheet(() => ({
  pad: { padding: 16 },
  flex: { flex: 1, minWidth: 0 },
  months: { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  hero: { backgroundColor: colors.blue, borderRadius: 26, padding: 20, gap: 4 },
  heroMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.white },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroTotal: { fontFamily: fonts.title, fontSize: 42, color: colors.white },
  heroUnit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  block: { gap: 10, padding: 16 },
  title: { fontFamily: fonts.title, fontSize: 18, color: colors.ink },
  inflRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infl: { fontFamily: fonts.title, fontSize: 34 },
  storeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  storeHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.neutral, marginVertical: 5, overflow: 'hidden' },
  barRow: { flexDirection: 'row', height: 10 },
  barFill: { borderRadius: 5, height: 10 },
  rank: { fontFamily: fonts.title, fontSize: 16, color: colors.muted, width: 16, textAlign: 'center' },
}));
