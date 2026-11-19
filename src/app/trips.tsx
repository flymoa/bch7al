import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CountUp, FadeIn } from '@/components/motion';
import { Empty, Header, ListGroup, ListRow, Pill, Screen, Tile } from '@/components/ui';
import { listMonths, listTrips, type TripRow } from '@/db';
import { currentMonth, longDate, money, monthLabel, plural } from '@/format';
import { bubble, colors, fonts, sheet, useTheme } from '@/theme';
import { space, tabular, type } from '@/tokens';

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
          <Empty title="Aucune course pour l'instant" text="Note ta première course : 30 secondes dans le magasin." action={{ label: 'Nouvelle course', icon: 'add', onPress: () => router.push('/trip/new') }} />
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
                  <CountUp value={total} format={money} /> <Text style={st.summaryUnit}>DH</Text>
                </Text>
              </View>
              {trips.length > 0 ? (
                <View style={st.avg}>
                  <Text style={st.summaryMeta}>moyenne</Text>
                  <Text style={st.avgValue}>{money(total / trips.length)}</Text>
                </View>
              ) : null}
            </View>
            {trips.length > 0 ? (
              <ListGroup>
                {trips.map((trip, i) => (
                  <FadeIn key={trip.id} index={i}>
                    <ListRow
                      label={`${trip.store}, ${longDate(trip.date)}`}
                      onPress={() => router.push(`/trip/${trip.id}`)}
                      first={i === 0}
                      leading={<Tile kind="store" text={trip.store} />}
                      title={trip.store}
                      meta={`${longDate(trip.date)} · ${plural(trip.n, 'article', 'articles')}`}
                      price={money(trip.total)}
                      unit="DH"
                    />
                  </FadeIn>
                ))}
              </ListGroup>
            ) : null}
          </ScrollView>
        </>
      )}
    </Screen>
  );
}

const st = sheet(() => ({
  pad: { padding: space.lg },
  months: { paddingHorizontal: space.lg, gap: space.sm, paddingVertical: space.sm },
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xl, gap: space.sm },
  summary: { backgroundColor: colors.blue, ...bubble(), padding: space.lg, flexDirection: 'row', alignItems: 'flex-end', marginBottom: space.sm },
  summaryMeta: { fontFamily: fonts.body, fontSize: type.caption, color: colors.white },
  summaryTotal: { fontFamily: fonts.titleBold, fontSize: type.priceHero, color: colors.white, ...tabular },
  summaryUnit: { fontFamily: fonts.bodyBold, fontSize: type.body },
  avg: { alignItems: 'flex-end' },
  avgValue: { fontFamily: fonts.title, fontSize: type.bodyLg, color: colors.white, ...tabular },
  grow: { flex: 1, minWidth: 0 },
}));
