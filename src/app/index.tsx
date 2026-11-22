// Accueil: the « bch7al … ? » question first, then the month in one night-ink block,
// the last trips, and what moved. One primary action (the + in the bar).
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Mark } from '@/components/brand';
import { Icon } from '@/components/icon';
import { CountUp, FadeIn } from '@/components/motion';
import { ChangeChip, Empty, Group, IconButton, Notice, PriceChip, Row, Screen, SectionHeader, Tile, openNewTrip, s as ui, t } from '@/components/ui';
import { getPref, listCount, listTrips, monthStats, previousMonth, type MonthStats, type TripRow } from '@/db';
import { addDays, currentMonth, longDate, money, moneyShort, monthLabel, pct, pctChange, plural, todayIso } from '@/format';
import { useSQLiteContext } from '@/sqlite';
import { bubble, colors, sheet, text, useTheme } from '@/theme';
import { radius, size, space } from '@/tokens';

export default function Home() {
  useTheme();
  const db = useSQLiteContext();
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [toBuy, setToBuy] = useState(0);
  const [needBackup, setNeedBackup] = useState(false);
  const [recap, setRecap] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const last = previousMonth(currentMonth());
        const [st, lastTrips, b, n, saved, before] = await Promise.all([
          monthStats(db, currentMonth()),
          listTrips(db, undefined, 3),
          getPref(db, 'budget'),
          listCount(db),
          getPref(db, 'lastBackup'),
          monthStats(db, last),
        ]);
        if (!alive) return;
        setStats(st);
        setTrips(lastTrips);
        setBudget(b && Number(b) > 0 ? Number(b) : null);
        setToBuy(n);
        // Data lives only on the phone: nudge after 30 days without a backup (or 3 trips and none).
        setNeedBackup(saved ? addDays(saved, 30) < todayIso() : lastTrips.length >= 3);
        setRecap(new Date().getDate() <= 7 && before.trips > 0 ? last : null);
      })();
      return () => { alive = false; };
    }, [db]),
  );

  const month = currentMonth();
  const vsPrev = stats ? pctChange(stats.prevTotal, stats.total) : null;
  const moves = (stats?.moves ?? []).filter((m) => Math.abs(m.change) >= 0.05).slice(0, 3);
  const empty = trips !== null && trips.length === 0;

  return (
    <Screen tab="home">
      <ScrollView contentContainerStyle={st.content}>
        <View style={st.head}>
          <Mark size={36} />
          <View style={ui.flex}>
            <Text style={st.brand} accessibilityLabel="bch7al">bch<Text style={st.seven}>7</Text>al?</Text>
            <Text style={t.meta}>3ref taman, chri mzyan.</Text>
          </View>
          <IconButton icon="settings" label="Réglages" onPress={() => router.push('/settings')} />
        </View>

        <Pressable
          accessibilityRole="search"
          accessibilityLabel="bch7al ? Chercher le prix d'un produit"
          onPress={() => router.push('/ask')}
          style={({ pressed }) => [st.ask, pressed && ui.pressed]}
        >
          <Icon name="search" color={colors.primary} />
          <Text style={st.askLead}>bch7al</Text>
          <Text style={st.askHint} numberOfLines={1}>le lait, l'huile, le thé…</Text>
          <Text style={st.askQ}>?</Text>
        </Pressable>

        {empty ? (
          <FadeIn>
            <Empty
              icon="receipt"
              darija="Mazal ma tqdditi walou"
              title="Note ta première course"
              text="Scanne ton ticket ou note tes achats à la main. Ton historique de prix se construit tout seul, sur ce téléphone."
              action={{ label: 'Scanner mon premier ticket', icon: 'scan', onPress: () => openNewTrip('scan') }}
            />
          </FadeIn>
        ) : stats ? (
          <FadeIn>
            <Pressable accessibilityRole="button" accessibilityLabel={`${monthLabel(month)} : ${money(stats.total)} dirhams`} onPress={() => router.replace('/month')} style={({ pressed }) => [st.hero, pressed && ui.pressedSoft]}>
              <View style={st.heroTop}>
                <Text style={st.heroOver}>{monthLabel(month).replace(/ \d{4}$/, '').toUpperCase()}</Text>
                <Icon name="next" size={size.iconDense} color={colors.onHeroMuted} />
              </View>
              <View style={st.heroRow}>
                <CountUp style={st.heroTotal} value={stats.total} format={moneyShort} />
                <Text style={st.heroUnit}>DH</Text>
              </View>
              <View style={st.heroMeta}>
                <Text style={st.heroMetaText}>{plural(stats.trips, 'course', 'courses')}</Text>
                {vsPrev !== null && stats.prevTotal > 0 ? (
                  <PriceChip onHero dir={Math.abs(vsPrev) < 0.5 ? 'same' : vsPrev > 0 ? 'up' : 'down'} label={`${vsPrev >= 0 ? '+' : '−'}${pct(vsPrev)} vs ${monthLabel(previousMonth(month)).replace(/ \d{4}$/, '').toLowerCase()}`} />
                ) : null}
              </View>
              {budget ? (
                <View style={st.budget} accessible accessibilityLabel={`${Math.round((stats.total / budget) * 100)} % du budget`}>
                  <View style={st.budgetTrack}>
                    <View style={[st.budgetFill, { width: `${Math.min(100, (stats.total / budget) * 100)}%` }]} />
                  </View>
                  <Text style={st.heroMetaText}>
                    {stats.total > budget ? `Budget dépassé de ${money(stats.total - budget)} DH` : `Il te reste ${moneyShort(budget - stats.total)} DH sur ${moneyShort(budget)}`}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </FadeIn>
        ) : null}

        {needBackup ? <Notice icon="export" text="Sauvegarde tes courses : elles ne sont que sur ce téléphone" onPress={() => router.push('/settings')} /> : null}
        {recap ? <Notice icon="month" text={`Ton mois de ${monthLabel(recap).replace(/ \d{4}$/, '').toLowerCase()} est prêt`} onPress={() => router.replace(`/month?month=${recap}`)} /> : null}
        {toBuy > 0 ? <Notice icon="list" text={`${plural(toBuy, 'article', 'articles')} sur ta liste`} onPress={() => router.replace('/list')} /> : null}

        {trips && trips.length > 0 ? (
          <FadeIn index={1}>
            <SectionHeader title="Dernières courses" action="Tout voir" onAction={() => router.push('/trips')} />
            <Group>
              {trips.map((trip, i) => (
                <Row
                  key={trip.id}
                  first={i === 0}
                  label={`${trip.store}, ${longDate(trip.date)}, ${money(trip.total)} dirhams`}
                  onPress={() => router.push(`/trip/${trip.id}`)}
                  leading={<Tile kind="store" text={trip.store} />}
                  title={trip.store}
                  meta={`${longDate(trip.date)} · ${plural(trip.n, 'article', 'articles')}`}
                  price={money(trip.total)}
                  unit="DH"
                />
              ))}
            </Group>
          </FadeIn>
        ) : null}

        {moves.length > 0 ? (
          <FadeIn index={2}>
            <SectionHeader title="Ça a bougé ce mois" action="Produits" onAction={() => router.replace('/products?sort=moves')} />
            <Group>
              {moves.map((m, i) => (
                <Row
                  key={m.id}
                  first={i === 0}
                  label={m.name}
                  onPress={() => router.push(`/product/${m.id}`)}
                  leading={<Tile text={m.name} />}
                  title={m.name}
                  meta={`avant ${money(m.before)} DH`}
                  price={money(m.now)}
                  unit="DH"
                  chip={<ChangeChip from={m.before} to={m.now} />}
                />
              ))}
            </Group>
          </FadeIn>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const st = sheet(() => ({
  content: { paddingHorizontal: size.screen, paddingTop: space.lg, paddingBottom: space.section, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  brand: { ...text('titleLg'), fontFamily: text('headline').fontFamily, color: colors.ink },
  seven: { color: colors.primary },
  ask: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 60, paddingLeft: space.lg, paddingRight: space.xl, ...bubble('lg'), backgroundColor: colors.surfaceContainer },
  askLead: { ...text('title'), color: colors.ink },
  askHint: { flex: 1, ...text('body'), color: colors.faint },
  askQ: { ...text('headlineSm'), color: colors.primary },
  hero: { ...bubble('hero'), backgroundColor: colors.hero, padding: space.xxl, gap: space.sm, marginTop: space.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroOver: { ...text('overline'), color: colors.onHeroMuted },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  heroTotal: { ...text('priceHero'), color: colors.onHero },
  heroUnit: { ...text('title'), color: colors.onHeroMuted },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  heroMetaText: { ...text('bodySm'), color: colors.onHeroMuted },
  budget: { gap: space.sm, marginTop: space.sm },
  budgetTrack: { height: space.sm, borderRadius: radius.pill, backgroundColor: colors.heroRaised, overflow: 'hidden' },
  budgetFill: { height: space.sm, borderRadius: radius.pill, backgroundColor: colors.onHero },
}));
