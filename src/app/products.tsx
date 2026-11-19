import { Icon } from '@/components/icon';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { FadeIn } from '@/components/motion';
import { ChangeChip, Empty, Header, ListRow, Screen, Tile } from '@/components/ui';
import { listProducts, type ProductRow } from '@/db';
import { money, plural } from '@/format';
import { colors, fonts, shadow, sheet, useTheme } from '@/theme';
import { radius, space, type } from '@/tokens';

export default function Products() {
  useTheme();
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
    <Screen>
      <Header title="Mes produits" />
      {nothingYet ? (
        <View style={st.pad}>
          <Empty title="Aucun produit pour l'instant" text="Les produits apparaissent ici dès que tu enregistres une course." action={{ label: 'Noter une course', icon: 'add', onPress: () => router.push('/trip/new') }} />
        </View>
      ) : (
        <>
          <View style={st.searchBox}>
            <Icon name="search" size={20} color={colors.muted} />
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
            renderItem={({ item: p, index }) => (
              <FadeIn index={index}>
              <ListRow
                label={p.name}
                onPress={() => router.push(`/product/${p.id}`)}
                first={index === 0}
                last={index === (rows?.length ?? 0) - 1}
                leading={<Tile text={p.name} />}
                title={p.name}
                meta={`Acheté ${p.n} fois · par ${p.unit}`}
                price={money(p.last_price ?? 0)}
                unit="DH"
                verdict={<ChangeChip from={p.prev_price} to={p.last_price} />}
              />
              </FadeIn>
            )}
          />
        </>
      )}
    </Screen>
  );
}

const st = sheet(() => ({
  pad: { padding: space.lg },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, marginTop: space.xs, paddingHorizontal: space.lg, minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.card, ...shadow },
  search: { flex: 1, minHeight: 48, fontFamily: fonts.body, fontSize: type.bodyLg, color: colors.ink },
  list: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xl },
  count: { fontFamily: fonts.bodyBold, fontSize: type.caption, color: colors.muted, paddingHorizontal: space.xs, paddingBottom: space.sm },
  grow: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: space.xs },
}));
