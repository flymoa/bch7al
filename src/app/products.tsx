import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChangeChip, Empty, Header, RowCard, Screen, Tile, t } from '@/components/ui';
import { listProducts, type ProductRow } from '@/db';
import { money, plural } from '@/format';
import { colors, fonts, shadow } from '@/theme';

export default function Products() {
  const db = useSQLiteContext();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ProductRow[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listProducts(db, search).then((res) => alive && setRows(res));
      return () => {
        alive = false;
      };
    }, [db, search]),
  );

  const nothingYet = rows !== null && rows.length === 0 && search.trim() === '';

  return (
    <Screen bottomBar="products">
      <Header title="Mes produits" back={false} />
      {nothingYet ? (
        <View style={st.pad}>
          <Empty title="Aucun produit pour l'instant" text="Les produits apparaissent ici dès que tu enregistres une course." />
        </View>
      ) : (
        <>
          <View style={st.searchBox}>
            <Ionicons name="search" size={20} color={colors.muted} />
            <TextInput
              accessibilityLabel="Chercher un produit"
              value={search}
              onChangeText={setSearch}
              placeholder="Chercher un produit"
              placeholderTextColor={colors.muted}
              style={st.search}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          <FlatList
            data={rows ?? []}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={st.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={rows ? <Text style={st.count}>{plural(rows.length, "produit", "produits")}</Text> : undefined}
            ListEmptyComponent={rows ? <Empty title="Aucun résultat" text={`Aucun produit ne correspond à « ${search.trim()} ».`} /> : undefined}
            renderItem={({ item: p }) => (
              <RowCard label={p.name} onPress={() => router.push(`/product/${p.id}`)}>
                <Tile text={p.name} />
                <View style={st.grow}>
                  <Text style={t.name} numberOfLines={1}>{p.name}</Text>
                  <Text style={t.meta}>
                    Acheté {p.n} fois · par {p.unit}
                  </Text>
                </View>
                <View style={st.right}>
                  <Text style={t.price}>{money(p.last_price ?? 0)}</Text>
                  <ChangeChip from={p.prev_price} to={p.last_price} />
                </View>
              </RowCard>
            )}
          />
        </>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  pad: { padding: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, paddingHorizontal: 14, minHeight: 50, borderRadius: 25, backgroundColor: colors.card, ...shadow },
  search: { flex: 1, minHeight: 50, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, gap: 8 },
  count: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.muted, paddingHorizontal: 4 },
  grow: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 3 },
});
