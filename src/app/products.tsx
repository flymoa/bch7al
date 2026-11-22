// Produits (tab): the whole price memory, search first. Each row: last price as the
// hero, the price per kg / L when the pack size is known, a sparkline and the last move.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { ChangeChip, Empty, Field, Pill, Row, Screen, ScreenTitle, Sparkline, Tile, openNewTrip, t } from '@/components/ui';
import { listProducts, recentPrices, type ProductRow } from '@/db';
import { basePrice, money, pctChange, perUnit as per, plural } from '@/format';
import { useSQLiteContext } from '@/sqlite';
import { colors, sheet, useTheme } from '@/theme';
import { radius, size, space } from '@/tokens';

type Sort = 'recent' | 'frequent' | 'name' | 'moves';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Récents' },
  { key: 'frequent', label: 'Fréquents' },
  { key: 'moves', label: 'En hausse' },
  { key: 'name', label: 'A–Z' },
];

export default function Products() {
  useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ sort?: string }>();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>(params.sort === 'moves' ? 'moves' : 'recent');
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [sparks, setSparks] = useState<Record<number, number[]>>({});
  const [failure, setFailure] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listProducts(db, search, sort === 'moves' ? 'recent' : sort)
        .then(async (res) => {
          if (!alive) return;
          setFailure('');
          setRows(res.filter((p) => !/timbre/i.test(p.name)));
          const sp = await recentPrices(db).catch(() => ({}));
          if (alive) setSparks(sp);
        })
        .catch((e) => alive && (setFailure(String((e as Error).message ?? e)), setRows([])));
      return () => { alive = false; };
    }, [db, search, sort]),
  );

  const shown = useMemo(() => {
    if (!rows || sort !== 'moves') return rows ?? [];
    return rows
      .map((p) => ({ p, c: pctChange(p.prev_price, p.last_price) }))
      .filter((x) => x.c !== null && x.c > 0.05)
      .sort((a, b) => (b.c as number) - (a.c as number))
      .map((x) => x.p);
  }, [rows, sort]);

  const nothingYet = rows !== null && rows.length === 0 && search.trim() === '' && !failure;

  return (
    <Screen tab="products">
      <ScreenTitle title="Produits" meta={rows && !nothingYet ? plural(rows.length, 'produit', 'produits') : undefined} />
      {nothingYet ? (
        <View style={st.pad}>
          <Empty icon="products" darija="Walou hna" title="Aucun produit pour l'instant" text="Chaque article d'une course arrive ici, avec son prix dans chaque magasin." action={{ label: 'Nouvelle course', icon: 'plus', onPress: () => openNewTrip('manual') }} />
        </View>
      ) : (
        <>
          <View style={st.search}>
            <View style={st.searchIcon}><Icon name="search" size={size.iconDense} color={colors.muted} /></View>
            <Field accessibilityLabel="Chercher un produit" value={search} onChangeText={setSearch} placeholder="Chercher un produit" autoCorrect={false} returnKeyType="search" style={st.searchField} />
          </View>
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.sorts}>
              {SORTS.map((x) => <Pill key={x.key} label={x.label} active={sort === x.key} onPress={() => setSort(x.key)} icon={x.key === 'moves' ? 'priceUp' : undefined} />)}
            </ScrollView>
          </View>
          <FlatList
            data={shown}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={st.list}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={14}
            ListEmptyComponent={rows ? (
              <Text style={[t.body, st.none]}>{failure ? `Erreur de lecture : ${failure}` : sort === 'moves' && !search ? "Aucun prix n'a monté à ton dernier achat. Mzyan." : `Aucun produit ne correspond à « ${search.trim()} ».`}</Text>
            ) : undefined}
            renderItem={({ item: p, index }) => {
              const base = p.last_price !== null && p.unit !== 'kg' && p.unit !== 'L' ? basePrice(p.last_price, p.unit, p.name) : null;
              return (
                <View style={[st.cell, index === 0 && st.cellFirst, index === shown.length - 1 && st.cellLast]}>
                  <Row
                    first={index === 0}
                    label={`${p.name}, ${money(p.last_price ?? 0)} dirhams`}
                    onPress={() => router.push(`/product/${p.id}`)}
                    leading={<Tile text={p.name} />}
                    title={p.name}
                    meta={
                      <View style={st.meta}>
                        <Sparkline values={sparks[p.id] ?? []} width={48} height={16} />
                        <Text style={t.meta} numberOfLines={1}>{`${plural(p.n, 'achat', 'achats')}${base ? ` · ${money(base.price)} DH/${base.base}` : ''}`}</Text>
                      </View>
                    }
                    price={money(p.last_price ?? 0)}
                    unit={`DH${per(p.unit)}`}
                    chip={<ChangeChip from={p.prev_price} to={p.last_price} />}
                  />
                </View>
              );
            }}
          />
        </>
      )}
    </Screen>
  );
}

const st = sheet(() => ({
  pad: { paddingHorizontal: size.screen },
  search: { marginHorizontal: size.screen, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: space.lg, zIndex: 1 },
  searchField: { paddingLeft: space.x3 + space.xs },
  sorts: { gap: space.sm, paddingHorizontal: size.screen, paddingVertical: space.md },
  list: { paddingHorizontal: size.screen, paddingBottom: space.section },
  cell: { backgroundColor: colors.surfaceContainer, overflow: 'hidden' },
  cellFirst: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  cellLast: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  none: { textAlign: 'center', paddingVertical: space.x3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));
