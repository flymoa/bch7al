import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CountUp, FadeIn } from '@/components/motion';
import { Empty, Header, Pill, RowCard, Screen, Tile, t } from '@/components/ui';
import { listMonths, listTrips, type TripRow } from '@/db';
import { currentMonth, longDate, money, monthLabel, plural } from '@/format';
import { colors, fonts, sheet, useTheme } from '@/theme';

export default function Trips() {
  useTheme();
  const db = useSQLiteContext();
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string>(currentMonth());
  const [trips, setTrips] = useState<TripRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const all = await listMonths(db);
        const shown = all.includes(month) || all.length === 0 ? month : all[0];
        const rows = await listTrips(db, shown);
        if (alive) {
          setMonths(all);
          setMonth(shown);
          setTrips(rows);
        }
      })();
      return () => {
        alive = false;
      };
    }, [db, month]),
  );

  const total = trips.reduce((sum, trip) => sum + trip.total, 0);

  return (
    <Screen>
      <Header title="Mes courses" />
      {months.length === 0 ? (
        <View style={st.pad}>
          <Empty title="Aucune course pour l'instant" text="Touche le bouton + en bas pour noter ta première course." />
        </View>
      ) : (
        <>
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.months}>
              {months.map((m) => (
                <Pill key={m} label={monthLabel(m)} active={m === month} onPress={() => setMonth(m)} />
              ))}
            </ScrollView>
          </View>
          <ScrollView contentContainerStyle={st.content}>
            <View style={st.summary}>
              <View style={st.grow}>
                <Text style={st.summaryMeta}>
                  {monthLabel(month)} · {plural(trips.length, 'course', 'courses')}
                </Text>
                <Text style={st.summaryTotal}>
                  <CountUp value={total} format={money} /> <Text style={st.summaryUnit}>MAD</Text>
                </Text>
              </View>
              {trips.length > 0 ? (
                <View style={st.avg}>
                  <Text style={st.summaryMeta}>En moyenne</Text>
                  <Text style={st.avgValue}>{money(total / trips.length)}</Text>
                </View>
              ) : null}
            </View>
            {trips.map((trip, i) => (
              <FadeIn key={trip.id} index={i}>
              <RowCard label={`${trip.store}, ${longDate(trip.date)}`} onPress={() => router.push(`/trip/${trip.id}`)}>
                <Tile kind="store" text={trip.store} />
                <View style={st.grow}>
                  <Text style={t.name} numberOfLines={1}>{trip.store}</Text>
                  <Text style={t.meta}>
                    {longDate(trip.date)} · {plural(trip.n, 'article', 'articles')}
                  </Text>
                </View>
                <Text style={t.price}>{money(trip.total)}</Text>
              </RowCard>
              </FadeIn>
            ))}
          </ScrollView>
        </>
      )}
    </Screen>
  );
}

const st = sheet(() => ({
  pad: { padding: 16 },
  months: { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
  summary: { backgroundColor: colors.night, borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  summaryMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.white },
  summaryTotal: { fontFamily: fonts.title, fontSize: 32, color: colors.white },
  summaryUnit: { fontFamily: fonts.bodyBold, fontSize: 15 },
  avg: { alignItems: 'flex-end' },
  avgValue: { fontFamily: fonts.title, fontSize: 18, color: colors.white },
  grow: { flex: 1, minWidth: 0 },
}));
