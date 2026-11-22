// One trip: store, date, total, and each line with its verdict against the usual price.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Alert } from '@/alert';
import { showToast } from '@/components/toast';
import { Button, Empty, Group, PriceChip, Row, Screen, Tile, TopBar, VerdictChip, t } from '@/components/ui';
import { deleteTrip, getTrip, tripVerdicts, type ItemRow, type TripRow } from '@/db';
import { longDate, money, perUnit, plural, qtyLabel, type Verdict } from '@/format';
import { STAMP_DUTY } from '@/receipt';
import { useSQLiteContext } from '@/sqlite';
import { bubble, colors, sheet, text, useTheme } from '@/theme';
import { radius, size, space } from '@/tokens';

export default function TripDetail() {
  useTheme();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [data, setData] = useState<{ trip: TripRow; items: ItemRow[] } | null | undefined>(undefined);
  const [verdicts, setVerdicts] = useState<Record<number, Verdict | null>>({});
  const [failure, setFailure] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getTrip(db, tripId)
        .then(async (res) => {
          if (!alive) return;
          setData(res);
          // Verdicts are a bonus: the trip shows even if they cannot be computed.
          const v = await tripVerdicts(db, tripId).catch(() => ({}));
          if (alive) setVerdicts(v);
        })
        .catch((e) => alive && (setFailure(String((e as Error).message ?? e)), setData(null)));
      return () => { alive = false; };
    }, [db, tripId]),
  );

  const confirmDelete = () => {
    Alert.alert('Supprimer cette course ?', 'Les prix notés dans cette course seront retirés de ton historique.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTrip(db, tripId);
            showToast('Course supprimée');
            if (router.canGoBack()) router.back();
            else router.replace('/trips');
          } catch (e) {
            Alert.alert('La suppression a échoué', String((e as Error).message ?? e));
          }
        },
      },
    ]);
  };

  if (data === undefined) return <Screen><TopBar /></Screen>;
  if (data === null) {
    return (
      <Screen>
        <TopBar title="Course" />
        <View style={st.pad}><Empty icon="receipt" title={failure ? 'Course illisible' : 'Course introuvable'} text={failure || 'Elle a peut-être été supprimée.'} /></View>
      </Screen>
    );
  }
  const { trip, items } = data;
  const known = items.map((it) => verdicts[it.id] ?? null).filter((v): v is Verdict => v !== null);
  const n = (k: Verdict['kind']) => known.filter((v) => v.kind === k).length;

  return (
    <Screen>
      <TopBar title="Course" />
      <ScrollView contentContainerStyle={st.content}>
        <View style={st.hero}>
          <View style={st.heroTop}>
            <Tile kind="store" text={trip.store} tone="hero" />
            <View style={st.flex}>
              <Text style={st.store} numberOfLines={1}>{trip.store}</Text>
              <Text style={st.heroMeta}>{longDate(trip.date)} · {plural(trip.n, 'article', 'articles')}</Text>
            </View>
          </View>
          <View style={st.totalRow}>
            <Text style={st.total} accessibilityLabel={`Total ${money(trip.total)} dirhams`}>{money(trip.total)}</Text>
            <Text style={st.unit}>DH</Text>
          </View>
          {known.length ? (
            <View style={st.summary}>
              {n('high') ? <PriceChip onHero dir="up" label={`${n('high')} ghali`} /> : null}
              {n('normal') ? <PriceChip onHero dir="same" label={`${n('normal')} normal`} /> : null}
              {n('good') ? <PriceChip onHero dir="down" label={`${n('good')} rkhis`} /> : null}
            </View>
          ) : (
            <Text style={st.heroMeta}>Rachète ces produits : je te dirai s'ils étaient rkhis ou ghali.</Text>
          )}
        </View>
        <Group>
          {items.map((it, i) => {
            const v = verdicts[it.id] ?? null;
            const stamp = it.name === STAMP_DUTY;
            return (
              <Row
                key={it.id}
                first={i === 0}
                label={`Voir ${it.name}`}
                onPress={stamp ? undefined : () => router.push(`/product/${it.product_id}`)}
                leading={<Tile text={it.name} />}
                title={it.name}
                meta={stamp ? 'taxe, pas un produit' : `${qtyLabel(it.qty, it.unit)} × ${money(it.unit_price)}${perUnit(it.unit)}${it.promo ? ' · promo' : ''}`}
                price={money(it.qty * it.unit_price)}
                chip={v ? <VerdictChip v={v} /> : null}
              />
            );
          })}
        </Group>
        <View style={st.actions}>
          <Button label="Modifier" icon="edit" kind="tonal" style={st.flex} onPress={() => router.push(`/trip/new?id=${trip.id}`)} />
          <Button label="Supprimer" icon="delete" kind="danger" style={st.flex} onPress={confirmDelete} />
        </View>
        <Text style={[t.meta, st.center]}>Les quantités et l'unité (pièce, kg, paquet) se corrigent dans « Modifier ».</Text>
      </ScrollView>
    </Screen>
  );
}

const st = sheet(() => ({
  flex: { flex: 1, minWidth: 0 },
  pad: { paddingHorizontal: size.screen },
  content: { paddingHorizontal: size.screen, paddingBottom: space.section, gap: space.md },
  hero: { backgroundColor: colors.hero, ...bubble('hero'), padding: space.xxl, gap: space.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  store: { ...text('titleLg'), color: colors.onHero },
  heroMeta: { ...text('bodySm'), color: colors.onHeroMuted },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  total: { ...text('display'), color: colors.onHero },
  unit: { ...text('title'), color: colors.onHeroMuted },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  center: { textAlign: 'center', borderRadius: radius.sm },
}));
