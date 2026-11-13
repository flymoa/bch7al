import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CountUp, FadeIn } from '@/components/motion';
import { Button, ChangeChip, RoundButton, Empty, RowCard, Screen, SectionTitle, Tile, s as ui, t } from '@/components/ui';
import { getPref, listCount, listProducts, listTrips, monthSummary, previousMonth, type MonthSummary, type ProductRow, type TripRow } from '@/db';
import { currentMonth, longDate, money, monthLabel, plural } from '@/format';
import { colors, fonts, sheet, useTheme } from '@/theme';

export default function Home() {
  useTheme();
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<MonthSummary>({ trips: 0, total: 0, items: 0 });
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const [who, setWho] = useState('');
  const [toBuy, setToBuy] = useState(0);
  /** During the first week of a month, last month's summary is offered. */
  const [recap, setRecap] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const last = previousMonth(currentMonth());
        const [sum, lastTrips, top, b, name, n, before] = await Promise.all([
          monthSummary(db, currentMonth()),
          listTrips(db, undefined, 3),
          listProducts(db, '', 'frequent', 3),
          getPref(db, 'budget'),
          getPref(db, 'name'),
          listCount(db),
          monthSummary(db, last),
        ]);
        if (alive) {
          setWho(name ?? '');
          setToBuy(n);
          setRecap(new Date().getDate() <= 7 && before.trips > 0 ? last : null);
          setBudget(b && Number(b) > 0 ? Number(b) : null);
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
          <View style={st.grow} />
          <RoundButton icon="settings-outline" label="Réglages" onPress={() => router.push('/settings')} />
        </View>
        <Text style={st.hello}>{who ? `Salam ${who} !` : 'Salam !'} Ton carnet de courses</Text>

        <Pressable accessibilityRole="button" accessibilityLabel="bch7al ? Chercher le prix d'un produit" onPress={() => router.push('/ask')} style={({ pressed }) => [st.ask, pressed && ui.pressed]}>
          <Ionicons name="search" size={22} color={colors.blue} />
          <Text style={st.askText}>Bch7al… le lait ? l'huile ?</Text>
        </Pressable>

        <FadeIn><View style={st.hero}>
          <Text style={st.heroMeta}>
            {monthLabel(currentMonth())} · {plural(summary.trips, 'course', 'courses')}
          </Text>
          <View style={st.heroTotalRow}>
            <CountUp style={st.heroTotal} value={summary.total} format={money} />
            <Text style={st.heroUnit}>MAD</Text>
          </View>
          {budget ? (
            <View style={st.budget}>
              <View style={st.budgetTrack} accessible accessibilityLabel={`${Math.round((summary.total / budget) * 100)} % du budget utilisé`}>
                <View style={[st.budgetFill, { width: `${Math.min(100, (summary.total / budget) * 100)}%`, backgroundColor: summary.total > budget ? '#FFC27A' : colors.accent }]} />
              </View>
              <Text style={st.heroMeta}>
                {summary.total > budget
                  ? `Budget dépassé de ${money(summary.total - budget)} MAD`
                  : `Il te reste ${money(budget - summary.total)} MAD sur ${money(budget).replace(',00', '')}`}
              </Text>
            </View>
          ) : (
            <Text style={st.heroMeta}>{plural(summary.items, 'article noté', 'articles notés')} ce mois</Text>
          )}
          <Button label="Nouvelle course" icon="add" tone="light" onPress={() => router.push('/trip/new')} style={st.heroButton} />
        </View></FadeIn>

        <View style={st.quick}>
          <Pressable accessibilityRole="button" accessibilityLabel="Scanner un ticket" onPress={() => router.push('/trip/new?scan=camera')} style={({ pressed }) => [st.quickBtn, pressed && ui.pressed]}>
            <View style={st.quickIcon}><Ionicons name="camera-outline" size={22} color={colors.softText} /></View>
            <View style={st.grow}>
              <Text style={st.quickTitle}>Scanner</Text>
              <Text style={t.meta} numberOfLines={1}>un ticket</Text>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Ma liste de courses, ${plural(toBuy, 'article', 'articles')}`} onPress={() => router.push('/list')} style={({ pressed }) => [st.quickBtn, pressed && ui.pressed]}>
            <View style={st.quickIcon}><Ionicons name="checkbox-outline" size={22} color={colors.softText} /></View>
            <View style={st.grow}>
              <Text style={st.quickTitle}>Ma liste</Text>
              <Text style={t.meta} numberOfLines={1}>{toBuy > 0 ? `${toBuy} à acheter` : 'à préparer'}</Text>
            </View>
          </Pressable>
        </View>

        {recap ? (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/recap?month=${recap}`)} style={({ pressed }) => [st.recap, pressed && ui.pressed]}>
            <Ionicons name="sparkles-outline" size={22} color={colors.softText} />
            <Text style={st.recapText}>Ton mois de {monthLabel(recap).toLowerCase()} est prêt</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.softText} />
          </Pressable>
        ) : null}

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
                  <Text style={t.price}>
                    {money(trip.total)} <Text style={t.unit}>MAD</Text>
                  </Text>
                </RowCard>
                </FadeIn>
              ))}
            </View>

            <SectionTitle action="Tout voir" onAction={() => router.replace('/products')}>
              Mes produits
            </SectionTitle>
            <View style={st.list}>
              {products.map((p, i) => (
                <FadeIn key={p.id} index={i + 3}>
                <RowCard label={p.name} onPress={() => router.push(`/product/${p.id}`)}>
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
                </FadeIn>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const st = sheet(() => ({
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontFamily: fonts.titleBold, fontSize: 32, color: colors.ink },
  seven: { color: colors.blue },
  arabic: { backgroundColor: colors.soft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  arabicText: { fontSize: 15, fontWeight: '700', color: colors.softText },
  hello: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 2, marginBottom: 12 },
  ask: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 26, borderWidth: 2, borderColor: colors.blue, paddingHorizontal: 16, minHeight: 54, marginBottom: 12 },
  askText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.muted },
  quick: { flexDirection: 'row', gap: 10, marginTop: 12 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 20, padding: 12, minHeight: 64, borderWidth: 1.5, borderColor: colors.line },
  quickIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { fontFamily: fonts.title, fontSize: 16, color: colors.ink },
  recap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.soft, borderRadius: 20, paddingHorizontal: 16, minHeight: 54, marginTop: 10 },
  recapText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.softText },
  hero: { backgroundColor: colors.blue, borderRadius: 28, padding: 20, gap: 4 },
  heroMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.white },
  heroTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroTotal: { fontFamily: fonts.title, fontSize: 46, color: colors.white },
  heroUnit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  heroButton: { marginTop: 12, borderWidth: 0, minHeight: 52 },
  gapTop: { marginTop: 18 },
  budget: { gap: 6, marginTop: 4 },
  budgetTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden', maxWidth: 260 },
  budgetFill: { height: 10, borderRadius: 5 },
  list: { gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 3 },
}));
