// Mes courses: every trip, month by month.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CountUp } from '@/components/motion';
import { Empty, Group, Pill, Row, Screen, Tile, TopBar, openNewTrip, t } from '@/components/ui';
import { listMonths, listTrips, type TripRow } from '@/db';
import { currentMonth, longDate, money, moneyShort, monthLabel, plural } from '@/format';
import { useSQLiteContext } from '@/sqlite';
import { colors, sheet, text, useTheme } from '@/theme';
import { size, space } from '@/tokens';

export default function Trips() {
  useTheme();
  const db = useSQLiteContext();
  const [months, setMonths] = useState<string[] | null>(null);
  const [month, setMonth] = useState<string>(currentMonth());
  const [trips, setTrips] = useState<TripRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const all = await listMonths(db);
        const shown = all.includes(month) || all.length === 0 ? month : all[0];
        const rows = await listTrips(db, shown);
        if (!alive) return;
        setMonths(all);
        setMonth(shown);
        setTrips(rows);
      })();
      return () => { alive = false; };
    }, [db, month]),
  );

  const total = trips.reduce((sum, trip) => sum + trip.total, 0);
  return (
    <Screen>
      <TopBar title="Mes courses" />
      {months && months.length === 0 ? (
        <View style={st.pad}>
          <Empty icon="receipt" title="Aucune course pour l'instant" text="Note ta première course : 30 secondes dans le magasin." action={{ label: 'Nouvelle course', icon: 'plus', onPress: () => openNewTrip('manual') }} />
        </View>
      ) : (
        <>
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.months}>
              {(months ?? []).map((m) => <Pill key={m} label={monthLabel(m)} active={m === month} onPress={() => setMonth(m)} />)}
            </ScrollView>
          </View>
          <ScrollView contentContainerStyle={st.content}>
            <View style={st.summary}>
              <View>
                <Text style={t.meta}>{monthLabel(month)} · {plural(trips.length, 'course', 'courses')}</Text>
                <View style={st.totalRow}>
                  <CountUp style={st.total} value={total} format={moneyShort} />
                  <Text style={st.unit}>DH</Text>
                </View>
              </View>
              {trips.length > 0 ? (
                <View style={st.avg}>
                  <Text style={t.meta}>par course</Text>
                  <Text style={t.price}>{money(total / trips.length)}</Text>
                </View>
              ) : null}
            </View>
            <Group>
              {trips.map((trip, i) => (
                <Row key={trip.id} first={i === 0} label={`${trip.store}, ${longDate(trip.date)}`} onPress={() => router.push(`/trip/${trip.id}`)} leading={<Tile kind="store" text={trip.store} />} title={trip.store} meta={`${longDate(trip.date)} · ${plural(trip.n, 'article', 'articles')}`} price={money(trip.total)} unit="DH" />
              ))}
            </Group>
          </ScrollView>
        </>
      )}
    </Screen>
  );
}

const st = sheet(() => ({
  pad: { paddingHorizontal: size.screen },
  months: { gap: space.sm, paddingHorizontal: size.screen, paddingBottom: space.md },
  content: { paddingHorizontal: size.screen, paddingBottom: space.section, gap: space.lg },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: space.xs },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  total: { ...text('display'), color: colors.ink },
  unit: { ...text('title'), color: colors.muted },
  avg: { alignItems: 'flex-end' },
}));
