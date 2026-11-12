import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, Header, Screen, Tile, s as ui, t } from '@/components/ui';
import { deleteTrip, getTrip, type ItemRow, type TripRow } from '@/db';
import { longDate, money, plural, qty } from '@/format';
import { colors, fonts } from '@/theme';

export default function TripDetail() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [data, setData] = useState<{ trip: TripRow; items: ItemRow[] } | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getTrip(db, tripId).then((res) => alive && setData(res));
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
  return (
    <Screen>
      <Header title="Course" />
      <ScrollView contentContainerStyle={st.content}>
        <View style={st.head}>
          <Tile text={trip.store} size={64} />
          <View style={ui.flex}>
            <Text style={st.store}>{trip.store}</Text>
            <Text style={t.meta}>
              {longDate(trip.date)} · {plural(trip.n, 'article', 'articles')}
            </Text>
          </View>
        </View>

        <Card style={st.items}>
          {items.map((it, i) => (
            <Pressable
              key={it.id}
              accessibilityRole="button"
              accessibilityLabel={`Voir ${it.name}`}
              onPress={() => router.push(`/product/${it.product_id}`)}
              style={({ pressed }) => [st.item, i > 0 && st.itemLine, pressed && ui.pressed]}
            >
              <View style={ui.flex}>
                <Text style={t.name}>{it.name}</Text>
                <Text style={t.meta}>
                  {qty(it.qty)} × {money(it.unit_price)} MAD / {it.unit}
                </Text>
              </View>
              <Text style={t.price}>{money(it.qty * it.unit_price)}</Text>
            </Pressable>
          ))}
          <View style={[st.item, st.totalLine]}>
            <Text style={st.totalLabel}>Total</Text>
            <Text style={st.total}>
              {money(trip.total)} <Text style={t.unit}>MAD</Text>
            </Text>
          </View>
        </Card>

        <Button label="Modifier" icon="create-outline" onPress={() => router.push(`/trip/new?id=${trip.id}`)} />
        <Button label="Supprimer" icon="trash-outline" tone="danger" onPress={confirmDelete} />
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  pad: { padding: 16 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  store: { fontFamily: fonts.title, fontSize: 24, color: colors.ink },
  items: { paddingVertical: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8 },
  itemLine: { borderTopWidth: 1, borderTopColor: colors.line },
  totalLine: { borderTopWidth: 2, borderTopColor: colors.ink, justifyContent: 'space-between' },
  totalLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  total: { fontFamily: fonts.title, fontSize: 24, color: colors.ink },
});
