import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CountUp, FadeIn } from '@/components/motion';
import { Button, ChangeChip, RoundButton, Empty, RowCard, Screen, SectionTitle, Tile, VerdictStrip, s as ui, t } from '@/components/ui';
import { getPref, listCount, listProducts, listTrips, monthSummary, previousMonth, tripVerdicts, type MonthSummary, type ProductRow, type TripRow } from '@/db';
import { currentMonth, longDate, money, monthLabel, plural, type Verdict } from '@/format';
import { colors, fonts, shadow, sheet, useTheme } from '@/theme';

export default function Home() {
  useTheme();
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<MonthSummary>({ trips: 0, total: 0, items: 0 });
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const [who, setWho] = useState('');
  const [toBuy, setToBuy] = useState(0);
  const [lastVerdicts, setLastVerdicts] = useState<(Verdict | null)[]>([]);
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
        const lv = lastTrips[0] ? Object.values(await tripVerdicts(db, lastTrips[0].id)) : [];
        if (alive) {
          setLastVerdicts(lv);
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
          <View style={st.grow}>
            <Text style={st.brand} accessibilityLabel="bch7al">
              bch<Text style={st.seven}>7</Text>al<Text style={st.seven}>?</Text>
            </Text>
            <Text style={st.hello}>{who ? `Salam, ${who}` : 'Salam !'}</Text>
          </View>
          <RoundButton icon="settings-outline" label="Réglages" onPress={() => router.push('/settings')} />
        </View>

        <FadeIn>
          <View style={st.hero}>
            <Text style={st.heroSeven} accessibilityElementsHidden importantForAccessibility="no">7</Text>
            <Text style={st.arabicText}>بشحال؟</Text>
            <Text style={st.heroTitle}>Bch7al…</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="bch7al ? Chercher le prix d'un produit" onPress={() => router.push('/ask')} style={({ pressed }) => [st.ask, pressed && ui.pressed]}>
              <Ionicons name="search" size={22} color={colors.blue} />
              <Text style={st.askText} numberOfLines={1}>le lait, l'huile, le thé</Text>
              <View style={st.askGo}>
                <Text style={st.askGoText}>?</Text>
              </View>
            </Pressable>
            {products.length > 0 ? (
              <View style={st.heroChips}>
                {products.map((p) => (
                  <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Prix de ${p.name}`} onPress={() => router.push(`/product/${p.id}`)} style={({ pressed }) => [st.heroChip, pressed && ui.pressed]}>
                    <Text style={st.heroChipText} numberOfLines={1}>{p.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </FadeIn>

        {trips[0] ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Dernière sortie : ${trips[0].store}, ${money(trips[0].total)} MAD`} onPress={() => router.push(`/trip/${trips[0].id}`)} style={({ pressed }) => [st.last, pressed && ui.pressed]}>
            <View style={st.lastHead}>
              <Text style={st.lastLabel}>DERNIÈRE SORTIE</Text>
              <Text style={t.meta}>{longDate(trips[0].date)}</Text>
            </View>
            <View style={st.lastRow}>
              <View style={st.grow}>
                <Text style={st.lastStore} numberOfLines={1}>{trips[0].store}</Text>
                <Text style={t.meta}>{plural(trips[0].n, 'article', 'articles')}</Text>
              </View>
              <Text style={st.lastTotal}>
                {money(trips[0].total)} <Text style={st.lastUnit}>MAD</Text>
              </Text>
            </View>
            <VerdictStrip verdicts={lastVerdicts} />
          </Pressable>
        ) : null}

        <View style={st.duo}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Ma liste de courses, ${plural(toBuy, 'article', 'articles')}`} onPress={() => router.push('/list')} style={({ pressed }) => [st.tile, st.tileSoft, pressed && ui.pressed]}>
            <Ionicons name="list" size={24} color={colors.softText} />
            <Text style={st.tileTitle}>Ma liste</Text>
            <Text style={t.meta} numberOfLines={2}>{toBuy > 0 ? `${toBuy} à acheter` : 'à préparer'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Mon mois, ${money(summary.total)} MAD`} onPress={() => router.replace('/stats')} style={({ pressed }) => [st.tile, st.tileBlue, pressed && ui.pressed]}>
            <Ionicons name="stats-chart" size={24} color={colors.white} />
            <Text style={[st.tileTitle, st.onBlue]}>{monthLabel(currentMonth())}</Text>
            <Text style={st.tileTotal} numberOfLines={1}>
              <CountUp style={st.tileTotal} value={summary.total} format={money} /> <Text style={st.tileUnit}>MAD</Text>
            </Text>
            <Text style={st.tileMeta} numberOfLines={1}>{plural(summary.trips, 'course', 'courses')} · {plural(summary.items, 'article', 'articles')}</Text>
          </Pressable>
        </View>

        {budget ? (
          <View style={st.budget}>
            <View style={st.budgetTrack} accessible accessibilityLabel={`${Math.round((summary.total / budget) * 100)} % du budget utilisé`}>
              <View style={[st.budgetFill, { width: `${Math.min(100, (summary.total / budget) * 100)}%`, backgroundColor: summary.total > budget ? colors.ink : colors.blue }]} />
            </View>
            <Text style={t.meta}>
              {summary.total > budget
                ? `Budget dépassé de ${money(summary.total - budget)} MAD`
                : `Il te reste ${money(budget - summary.total)} MAD sur ${money(budget).replace(',00', '')}`}
            </Text>
          </View>
        ) : null}

        <Button label="Nouvelle course" icon="add" onPress={() => router.push('/trip/new')} style={st.newTrip} />

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
            <SectionTitle action="Tout voir" onAction={() => router.push('/trips')}>
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

            <SectionTitle action="Tout voir" onAction={() => router.push('/products')}>
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
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  brand: { fontFamily: fonts.titleBold, fontSize: 28, color: colors.ink, letterSpacing: -0.5 },
  seven: { color: colors.blue },
  hello: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 2 },
  hero: { backgroundColor: colors.night, borderRadius: 28, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 22, overflow: 'hidden' },
  heroSeven: { position: 'absolute', right: 2, top: -34, fontFamily: fonts.titleBold, fontSize: 170, lineHeight: 190, color: colors.nightSoft },
  arabicText: { fontFamily: fonts.title, fontSize: 20, color: colors.onNight, alignSelf: 'flex-start' },
  heroTitle: { fontFamily: fonts.titleBold, fontSize: 42, lineHeight: 50, letterSpacing: -1, color: colors.white, marginBottom: 12 },
  ask: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 28, paddingLeft: 18, paddingRight: 6, minHeight: 56 },
  askText: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: '#46557F' },
  askGo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1F4BFF', alignItems: 'center', justifyContent: 'center' },
  askGoText: { fontFamily: fonts.titleBold, fontSize: 22, color: '#FFFFFF' },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  heroChip: { minHeight: 44, maxWidth: '100%', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderColor: colors.nightBlue, justifyContent: 'center' },
  heroChipText: { fontFamily: fonts.body, fontSize: 14, color: '#E6EDFF' },
  last: { marginTop: 12, backgroundColor: colors.card, borderRadius: 24, padding: 18, gap: 12, ...shadow },
  lastHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastLabel: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.5, color: colors.muted },
  lastRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  lastStore: { fontFamily: fonts.title, fontSize: 22, color: colors.ink },
  lastTotal: { fontFamily: fonts.titleBold, fontSize: 30, letterSpacing: -0.5, color: colors.ink },
  lastUnit: { fontFamily: fonts.title, fontSize: 15, color: colors.muted },
  duo: { flexDirection: 'row', gap: 12, marginTop: 12 },
  tile: { flex: 1, minHeight: 128, borderRadius: 24, padding: 16, gap: 4 },
  tileSoft: { backgroundColor: colors.soft },
  tileBlue: { backgroundColor: colors.blue },
  tileTitle: { fontFamily: fonts.title, fontSize: 18, color: colors.ink, marginTop: 6 },
  onBlue: { color: colors.white },
  tileTotal: { fontFamily: fonts.titleBold, fontSize: 20, color: colors.white },
  tileUnit: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
  tileMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.white },
  recap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.soft, borderRadius: 20, paddingHorizontal: 16, minHeight: 54, marginTop: 10 },
  recapText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.softText },
  newTrip: { marginTop: 12 },
  gapTop: { marginTop: 18 },
  budget: { gap: 6, marginTop: 12, backgroundColor: colors.card, borderRadius: 20, padding: 14 },
  budgetTrack: { height: 10, borderRadius: 5, backgroundColor: colors.soft, overflow: 'hidden' },
  budgetFill: { height: 10, borderRadius: 5 },
  list: { gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 3 },
}));
