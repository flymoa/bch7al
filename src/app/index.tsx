import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useState } from 'react';
import { Icon } from '@/components/icon';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CountUp, FadeIn } from '@/components/motion';
import { Mark } from '@/components/brand';
import { Empty, RoundButton, Screen, Tile, VerdictStrip, s as ui, t } from '@/components/ui';
import { getPref, listCount, listPlan, listTrips, monthSummary, previousMonth, tripVerdicts, type MonthSummary, type TripRow } from '@/db';
import { addDays, currentMonth, longDate, todayIso, money, monthLabel, plural, type Verdict } from '@/format';
import { bubble, bubbleRight, colors, currentScheme, fonts, shadow, sheet, useTheme } from '@/theme';
import { radius, space, tabular, type } from '@/tokens';

export default function Home() {
  useTheme();
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<MonthSummary>({ trips: 0, total: 0, items: 0 });
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const [toBuy, setToBuy] = useState(0);
  const [bestStore, setBestStore] = useState<string | null>(null);
  /** Data lives only on the phone: nudge for a backup after 30 days (or 3 trips with none). */
  const [needBackup, setNeedBackup] = useState(false);
  const [lastVerdicts, setLastVerdicts] = useState<(Verdict | null)[]>([]);
  /** During the first week of a month, last month's summary is offered. */
  const [recap, setRecap] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const last = previousMonth(currentMonth());
        const [sum, lastTrips, b, n, before, saved, plan] = await Promise.all([
          monthSummary(db, currentMonth()),
          listTrips(db, undefined, 3),
          getPref(db, 'budget'),
          listCount(db),
          monthSummary(db, last),
          getPref(db, 'lastBackup'),
          listPlan(db),
        ]);
        const lv = lastTrips[0] ? Object.values(await tripVerdicts(db, lastTrips[0].id)) : [];
        if (alive) {
          setLastVerdicts(lv);
          setNeedBackup(saved ? addDays(saved, 30) < todayIso() : lastTrips.length >= 3);
          setToBuy(n);
          setBestStore(plan.todo > 0 && plan.stores[0]?.covered === plan.todo ? plan.stores[0].store : null);
          setRecap(new Date().getDate() <= 7 && before.trips > 0 ? last : null);
          setBudget(b && Number(b) > 0 ? Number(b) : null);
          setSummary(sum);
          setTrips(lastTrips);
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
        <View style={st.head}>
          <Mark size={42} />
          <View style={st.grow}>
            <Text style={st.brand} accessibilityLabel="bch7al">
              bch<Text style={st.seven}>7</Text>al?
            </Text>
            <Text style={st.slogan}>3ref taman, chri mzyan.</Text>
          </View>
          <RoundButton icon="settings-outline" label="Réglages" onPress={() => router.push('/settings')} />
        </View>

        <FadeIn>
          <View style={st.ask}>
            <View style={st.askTop}>
              <Text style={st.askTitle}>Bch7al…</Text>
              <Text style={st.arabic}>بشحال؟</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="bch7al ? Chercher le prix d'un produit" onPress={() => router.push('/ask')} style={({ pressed }) => [st.search, pressed && ui.pressed]}>
              <Icon name="search" size={22} color={colors.blue} />
              <Text style={st.searchText} numberOfLines={1}>le lait, l'huile, le thé…</Text>
              <View style={st.searchGo}>
                <Text style={st.searchGoText}>?</Text>
              </View>
            </Pressable>
          </View>
        </FadeIn>

        {trips[0] ? (
          <FadeIn index={1}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Dernière sortie : ${trips[0].store}, ${money(trips[0].total)} DH`} onPress={() => router.push(`/trip/${trips[0].id}`)} style={({ pressed }) => [st.last, pressed && ui.pressed]}>
              <View style={st.lastHead}>
                <Text style={st.label}>DERNIÈRE SORTIE</Text>
                <Text style={t.meta}>{longDate(trips[0].date)}</Text>
              </View>
              <View style={st.lastRow}>
                <Tile kind="store" text={trips[0].store} />
                <View style={st.grow}>
                  <Text style={st.lastStore} numberOfLines={1}>{trips[0].store}</Text>
                  <Text style={t.meta}>{plural(trips[0].n, 'article', 'articles')}</Text>
                </View>
                <Text style={st.lastTotal}>
                  {money(trips[0].total)}
                  <Text style={st.lastUnit}> DH</Text>
                </Text>
              </View>
              <VerdictStrip verdicts={lastVerdicts} />
            </Pressable>
          </FadeIn>
        ) : null}

        <FadeIn index={2}>
          <View style={st.duo}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Ta liste, ${plural(toBuy, 'article', 'articles')}`} onPress={() => router.replace('/list')} style={({ pressed }) => [st.tile, st.tileSky, pressed && ui.pressed]}>
              <Icon name="list" size={24} color={colors.softText} />
              <Text style={st.tileTitle}>Ta liste</Text>
              <Text style={t.meta} numberOfLines={2}>
                {toBuy > 0 ? `${plural(toBuy, 'article', 'articles')}${bestStore ? ` · ${bestStore} le moins cher` : ''}` : 'à préparer'}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Ton mois, ${money(summary.total)} DH`} onPress={() => router.replace('/stats')} style={({ pressed }) => [st.tile, st.tileInk, pressed && ui.pressed]}>
              <Icon name="stats-chart" size={24} color={colors.nightBlue} />
              <Text style={[st.tileTitle, st.onInk]}>{monthLabel(currentMonth()).replace(/ \d{4}$/, '')}</Text>
              <Text style={st.tileTotal} numberOfLines={1}>
                <CountUp style={st.tileTotal} value={summary.total} format={(v) => money(v).replace(/,00$/, '')} />
                <Text style={st.tileUnit}> DH</Text>
              </Text>
            </Pressable>
          </View>
        </FadeIn>

        {budget ? (
          <View style={st.budget}>
            <View style={st.budgetTrack} accessible accessibilityLabel={`${Math.round((summary.total / budget) * 100)} % du budget utilisé`}>
              <View style={[st.budgetFill, { width: `${Math.min(100, (summary.total / budget) * 100)}%`, backgroundColor: summary.total > budget ? colors.ink : colors.blue }]} />
            </View>
            <Text style={t.meta}>
              {summary.total > budget
                ? `Budget dépassé de ${money(summary.total - budget)} DH`
                : `Il te reste ${money(budget - summary.total)} DH sur ${money(budget).replace(',00', '')}`}
            </Text>
          </View>
        ) : null}

        {trips.length > 0 ? (
        <View style={st.actions}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/trip/new')} style={({ pressed }) => [st.action, st.actionMain, pressed && ui.pressed]}>
            <Icon name="add" size={22} color={colors.blue} />
            <Text style={st.actionText} numberOfLines={1}>Nouvelle course</Text>
          </Pressable>
        </View>
        ) : null}

        {trips.length > 0 ? (
        <View style={st.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Mes courses" onPress={() => router.push('/trips')} style={({ pressed }) => [st.action, pressed && ui.pressed]}>
            <Icon name="receipt-outline" size={22} color={colors.ink} />
            <Text style={[st.actionText, st.actionTextQuiet]} numberOfLines={1}>Courses</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Tous mes produits achetés" onPress={() => router.push('/products')} style={({ pressed }) => [st.action, pressed && ui.pressed]}>
            <Icon name="cube-outline" size={22} color={colors.ink} />
            <Text style={[st.actionText, st.actionTextQuiet]} numberOfLines={1}>Produits</Text>
          </Pressable>
        </View>
        ) : null}

        {needBackup ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Sauvegarder mes courses" onPress={() => router.push('/settings')} style={({ pressed }) => [st.note, pressed && ui.pressed]}>
            <Icon name="cloud-upload-outline" size={22} color={colors.softText} />
            <Text style={st.noteText}>Sauvegarde tes courses : elles ne sont que sur ce téléphone</Text>
            <Icon name="chevron-forward" size={20} color={colors.softText} />
          </Pressable>
        ) : null}

        {recap ? (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/recap?month=${recap}`)} style={({ pressed }) => [st.note, pressed && ui.pressed]}>
            <Icon name="sparkles-outline" size={22} color={colors.softText} />
            <Text style={st.noteText}>Ton mois de {monthLabel(recap).toLowerCase()} est prêt</Text>
            <Icon name="chevron-forward" size={20} color={colors.softText} />
          </Pressable>
        ) : null}

        {trips.length === 0 ? (
          <View style={st.gapTop}>
            <Empty
              title="Note ta première course"
              text="Scanne ton ticket avec le bouton du milieu, ou note tes achats à la main. Ton historique de prix se construit tout seul."
              action={{ label: 'Nouvelle course', icon: 'add', onPress: () => router.push('/trip/new') }}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const st = sheet(() => ({
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xxl, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  brand: { fontFamily: fonts.titleBold, fontSize: type.title, letterSpacing: -0.5, color: colors.ink },
  seven: { color: colors.blue },
  slogan: { fontFamily: fonts.body, fontSize: type.caption, color: colors.muted },
  ask: { backgroundColor: colors.blue, ...bubble(radius.lg), padding: space.lg },
  askTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  askTitle: { fontFamily: fonts.titleBold, fontSize: type.h1, letterSpacing: -0.8, color: colors.white },
  arabic: { fontFamily: fonts.bodyMedium, fontSize: type.bodyLg, color: colors.onBlue },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, minHeight: 56, borderRadius: radius.pill, backgroundColor: currentScheme() === 'dark' ? colors.bg : colors.card, paddingLeft: space.lg, paddingRight: space.sm },
  searchText: { flex: 1, fontFamily: fonts.body, fontSize: type.bodyLg, color: colors.muted },
  searchGo: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: currentScheme() === 'dark' ? colors.white : colors.night, alignItems: 'center', justifyContent: 'center' },
  searchGoText: { fontFamily: fonts.titleBold, fontSize: type.title, color: currentScheme() === 'dark' ? colors.blue : colors.white },
  last: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, gap: space.md, ...shadow },
  lastHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontFamily: fonts.bodyBold, fontSize: type.caption, letterSpacing: 0.6, color: colors.muted },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lastStore: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.ink },
  lastTotal: { fontFamily: fonts.titleBold, fontSize: type.price, letterSpacing: -0.5, color: colors.ink, ...tabular },
  lastUnit: { fontFamily: fonts.bodyMedium, fontSize: type.caption, color: colors.muted, letterSpacing: 0 },
  duo: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, minHeight: 120, padding: space.lg, gap: space.xs },
  tileSky: { backgroundColor: colors.soft, ...bubble(radius.lg) },
  tileInk: { backgroundColor: colors.night, ...bubbleRight(radius.lg) },
  tileTitle: { fontFamily: fonts.title, fontSize: type.body, color: colors.ink, marginTop: space.sm },
  onInk: { color: colors.onNight },
  tileTotal: { fontFamily: fonts.titleBold, fontSize: type.h1, color: colors.white, ...tabular },
  tileUnit: { fontFamily: fonts.bodyMedium, fontSize: type.caption, color: colors.onNight },
  budget: { gap: space.sm, backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg },
  budgetTrack: { height: space.sm, borderRadius: space.xs, backgroundColor: colors.soft, overflow: 'hidden' },
  budgetFill: { height: space.sm, borderRadius: space.xs },
  actions: { flexDirection: 'row', gap: space.md },
  actionMain: { flex: 1.4, backgroundColor: colors.soft, borderColor: colors.soft },
  action: { flex: 1, minHeight: 56, borderRadius: radius.pill, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line },
  actionText: { fontFamily: fonts.title, fontSize: type.body, color: colors.blue },
  actionTextQuiet: { color: colors.ink },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.soft, ...bubble(radius.md), paddingHorizontal: space.lg, minHeight: 56 },
  noteText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.softText },
  gapTop: { marginTop: space.xs },
  grow: { flex: 1, minWidth: 0 },
}));
