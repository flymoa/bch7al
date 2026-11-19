import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Alert } from '@/alert';
import { Button, Empty, Header, ListGroup, ListRow, Screen, VerdictBadge, VerdictStrip, t } from '@/components/ui';
import { showToast } from '@/components/toast';
import { deleteTrip, getTrip, tripVerdicts, type ItemRow, type TripRow } from '@/db';
import { longDate, money, plural, qtyLabel, type Verdict } from '@/format';
import { bubble, colors, fonts, sheet, useTheme } from '@/theme';
import { radius, space, tabular, type } from '@/tokens';

export default function TripDetail() {
  useTheme();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [data, setData] = useState<{ trip: TripRow; items: ItemRow[] } | null | undefined>(undefined);
  const [verdicts, setVerdicts] = useState<Record<number, Verdict | null>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([getTrip(db, tripId), tripVerdicts(db, tripId)]).then(([res, v]) => {
        if (!alive) return;
        setVerdicts(v);
        setData(res);
      });
      return () => {
        alive = false;
      };
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
            router.canGoBack() ? router.back() : router.replace('/trips');
          } catch (e) {
            Alert.alert('La suppression a échoué', String((e as Error).message ?? e));
          }
        },
      },
    ]);
  };

  if (data === undefined) return <Screen><Header title="Course" /></Screen>;
  if (data === null) {
    return (
      <Screen>
        <Header title="Course" />
        <View style={st.pad}>
          <Empty title="Course introuvable" text="Elle a peut-être été supprimée." />
        </View>
      </Screen>
    );
  }

  const { trip, items } = data;
  const known = items.map((it) => verdicts[it.id] ?? null);
  return (
    <Screen>
      <Header title="Course" />
      <ScrollView contentContainerStyle={st.content}>
        <View>
          <Text style={st.h1} numberOfLines={1}>{trip.store}</Text>
          <Text style={t.meta}>{longDate(trip.date)}</Text>
          <Text style={st.total} accessibilityLabel={`Total ${money(trip.total)} dirhams`}>
            {money(trip.total)} <Text style={st.totalUnit}>DH</Text>
          </Text>
        </View>

        <View style={st.night}>
          <View style={st.nightHead}>
            <Text style={st.nightTitle}>{plural(trip.n, 'article', 'articles')}</Text>
            {known.some(Boolean) ? <Text style={st.nightMeta}>comparés à tes prix habituels</Text> : null}
          </View>
          {known.some(Boolean) ? (
            <VerdictStrip verdicts={known} onNight />
          ) : (
            <Text style={st.nightMeta}>Rachète ces produits ailleurs ou plus tard : je te dirai s'ils étaient mzyan ou ghali.</Text>
          )}
        </View>

        <ListGroup>
          {items.map((it, i) => {
            const v = verdicts[it.id] ?? null;
            return (
              <ListRow
                key={it.id}
                label={`Voir ${it.name}`}
                onPress={() => router.push(`/ask?id=${it.product_id}`)}
                first={i === 0}
                title={it.name}
                meta={`${qtyLabel(it.qty, it.unit)} × ${money(it.unit_price)}${it.unit === 'pièce' ? '' : ` / ${it.unit}`}`}
                price={money(it.qty * it.unit_price)}
                verdict={v ? <VerdictBadge v={v} /> : null}
              />
            );
          })}
        </ListGroup>

        <Button label="Modifier" icon="create-outline" onPress={() => router.push(`/trip/new?id=${trip.id}`)} />
        <Button label="Supprimer" icon="trash-outline" tone="danger" onPress={confirmDelete} />
      </ScrollView>
    </Screen>
  );
}

const st = sheet(() => ({
  pad: { padding: space.lg },
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xl, gap: space.lg },
  h1: { fontFamily: fonts.title, fontSize: type.title, color: colors.ink },
  night: { backgroundColor: colors.night, ...bubble(radius.lg), padding: space.lg, gap: space.md },
  nightHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  nightTitle: { fontFamily: fonts.title, fontSize: type.bodyLg, color: colors.white },
  nightMeta: { fontFamily: fonts.body, fontSize: type.caption, color: colors.onNight },
  total: { fontFamily: fonts.titleBold, fontSize: type.priceHero, color: colors.ink, marginTop: space.sm, ...tabular },
  totalUnit: { fontFamily: fonts.title, fontSize: type.body, color: colors.muted },
}));
