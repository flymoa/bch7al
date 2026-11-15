import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Alert } from '@/alert';
import { Button, Empty, Header, Screen, VerdictBadge, VerdictStrip, s as ui, t } from '@/components/ui';
import { showToast } from '@/components/toast';
import { deleteTrip, getTrip, tripVerdicts, type ItemRow, type TripRow } from '@/db';
import { longDate, money, plural, qtyLabel, type Verdict } from '@/format';
import { bubble, colors, fonts, sheet, useTheme } from '@/theme';

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
      <Header title="Ticket" />
      <ScrollView contentContainerStyle={st.content}>
        <View>
          <Text style={st.h1}>{trip.store}</Text>
          <Text style={t.meta}>{longDate(trip.date)}</Text>
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

        <View style={st.items}>
          {items.map((it) => {
            const v = verdicts[it.id] ?? null;
            return (
              <Pressable
                key={it.id}
                accessibilityRole="button"
                accessibilityLabel={`Voir ${it.name}`}
                onPress={() => router.push(`/ask?id=${it.product_id}`)}
                style={({ pressed }) => [st.item, pressed && ui.pressed]}
              >
                <View style={ui.flex}>
                  <Text style={t.name} numberOfLines={1}>{it.name}</Text>
                  <Text style={t.meta} numberOfLines={1}>
                    {qtyLabel(it.qty, it.unit)} × {money(it.unit_price)}
                    {it.unit === 'pièce' ? '' : ` / ${it.unit}`}
                  </Text>
                </View>
                {v ? <VerdictBadge v={v} /> : null}
                <Text style={st.itemPrice}>{money(it.qty * it.unit_price)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={st.totalRow}>
          <View>
            <Text style={t.meta}>Total</Text>
            <Text style={st.total}>
              {money(trip.total)} <Text style={st.totalUnit}>DH</Text>
            </Text>
          </View>
          <Button label="Modifier" icon="create-outline" style={st.edit} onPress={() => router.push(`/trip/new?id=${trip.id}`)} />
        </View>
        <Button label="Supprimer" icon="trash-outline" tone="danger" onPress={confirmDelete} />
      </ScrollView>
    </Screen>
  );
}

const st = sheet(() => ({
  pad: { padding: 16 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 14 },
  h1: { fontFamily: fonts.titleBold, fontSize: 28, letterSpacing: -0.6, color: colors.ink },
  night: { backgroundColor: colors.night, ...bubble(26), padding: 18, gap: 12 },
  nightHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  nightTitle: { fontFamily: fonts.title, fontSize: 17, color: colors.white },
  nightMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.onNight },
  items: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.card, borderRadius: 18 },
  itemPrice: { width: 64, textAlign: 'right', fontFamily: fonts.title, fontSize: 16, color: colors.ink },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  total: { fontFamily: fonts.titleBold, fontSize: 26, color: colors.ink },
  totalUnit: { fontFamily: fonts.title, fontSize: 14, color: colors.muted },
  edit: { minWidth: 150 },
}));
