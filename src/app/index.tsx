import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ChangeChip, Empty, RowCard, Screen, SectionTitle, Tile, t } from '@/components/ui';
import { listProducts, listTrips, monthSummary, type MonthSummary, type ProductRow, type TripRow } from '@/db';
import { currentMonth, longDate, money, monthLabel, plural } from '@/format';
import { colors, fonts } from '@/theme';

export default function Home() {
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<MonthSummary>({ trips: 0, total: 0, items: 0 });
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [sum, lastTrips, top] = await Promise.all([
          monthSummary(db, currentMonth()),
          listTrips(db, undefined, 3),
          listProducts(db, '', 'frequent', 3),
        ]);
        if (alive) {
          setSummary(sum);
          setTrips(lastTrips);
          setProducts(top);
        }
      })();
      return () => {
        alive = false;
      };
    }, [db]),
  );

  return (
    <Screen bottomBar="home">
      <ScrollView contentContainerStyle={st.content}>
        <View style={st.brandRow}>
          <Text style={st.brand} accessibilityLabel="bch7al">
            bch<Text style={st.seven}>7</Text>al?
          </Text>
          <View style={st.arabic}>
            <Text style={st.arabicText}>بشحال؟</Text>
          </View>
        </View>
        <Text style={st.hello}>Salam ! Ton carnet de courses</Text>

        <View style={st.hero}>
          <Text style={st.heroMeta}>
            {monthLabel(currentMonth())} · {plural(summary.trips, 'course', 'courses')}
          </Text>
          <View style={st.heroTotalRow}>
            <Text style={st.heroTotal}>{money(summary.total)}</Text>
            <Text style={st.heroUnit}>MAD</Text>
          </View>
          <Text style={st.heroMeta}>{plural(summary.items, 'article noté', 'articles notés')} ce mois</Text>
          <Button label="Nouvelle course" icon="add" tone="light" onPress={() => router.push('/trip/new')} style={st.heroButton} />
        </View>

        {trips.length === 0 ? (
          <View style={st.gapTop}>
            <Empty
              title="Note ta première course"
              text="Après chaque passage au magasin ou au souk, ajoute ce que tu as acheté et à quel prix. Ton historique se construit tout seul."
            />
          </View>
        ) : (
          <>
            <SectionTitle action="Tout voir" onAction={() => router.replace('/trips')}>
              Mes dernières courses
            </SectionTitle>
            <View style={st.list}>
              {trips.map((trip) => (
                <RowCard key={trip.id} label={`${trip.store}, ${longDate(trip.date)}`} onPress={() => router.push(`/trip/${trip.id}`)}>
                  <Tile text={trip.store} />
                  <View style={st.grow}>
                    <Text style={t.name} numberOfLines={1}>{trip.store}</Text>
                    <Text style={t.meta}>
                      {longDate(trip.date)} · {plural(trip.n, 'article', 'articles')}
                    </Text>
                  </View>
                  <Text style={t.price}>
                    {money(trip.total)} <Text style={t.unit}>MAD</Text>
                  </Text>
                </RowCard>
              ))}
            </View>

            <SectionTitle action="Tout voir" onAction={() => router.replace('/products')}>
              Mes produits
            </SectionTitle>
            <View style={st.list}>
              {products.map((p) => (
                <RowCard key={p.id} label={p.name} onPress={() => router.push(`/product/${p.id}`)}>
                  <Tile text={p.name} />
                  <View style={st.grow}>
                    <Text style={t.name} numberOfLines={1}>{p.name}</Text>
                    <Text style={t.meta}>Acheté {p.n} fois</Text>
                  </View>
                  <View style={st.right}>
                    <Text style={t.price}>
                      {money(p.last_price ?? 0)} <Text style={t.unit}>MAD</Text>
                    </Text>
                    <ChangeChip from={p.prev_price} to={p.last_price} />
                  </View>
                </RowCard>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontFamily: fonts.titleBold, fontSize: 32, color: colors.ink },
  seven: { color: colors.blue },
  arabic: { backgroundColor: colors.soft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  arabicText: { fontSize: 15, fontWeight: '700', color: colors.softText },
  hello: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 2, marginBottom: 14 },
  hero: { backgroundColor: colors.blue, borderRadius: 28, padding: 20, gap: 4 },
  heroMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.white },
  heroTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroTotal: { fontFamily: fonts.title, fontSize: 46, color: colors.white },
  heroUnit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  heroButton: { marginTop: 12, borderWidth: 0, minHeight: 52 },
  gapTop: { marginTop: 18 },
  list: { gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 3 },
});
