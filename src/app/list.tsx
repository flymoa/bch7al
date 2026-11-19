// Shopping list: what to buy next time, what each article costs where, and the store
// that suits the list best according to the prices already noted.
import { Icon } from '@/components/icon';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pop } from '@/components/motion';
import { showToast } from '@/components/toast';
import { Button, Card, Empty, ListGroup, Screen, s as ui, t } from '@/components/ui';
import { addListItem, clearListDone, listPlan, listProducts, removeListItem, setListDone, type ListLine, type ListPlan, type ProductRow } from '@/db';
import { money, plural, productKey } from '@/format';
import { bubble, colors, fonts, sheet, useTheme } from '@/theme';
import { radius, space, tabular, type } from '@/tokens';

export default function ShoppingList() {
  useTheme();
  const db = useSQLiteContext();
  const [plan, setPlan] = useState<ListPlan>({ lines: [], stores: [], todo: 0, known: 0 });
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [name, setName] = useState('');
  const [sel, setSel] = useState<string | null>(null);

  const refresh = useCallback(async () => setPlan(await listPlan(db)), [db]);
  useEffect(() => {
    refresh();
    listProducts(db, '', 'frequent').then(setProducts);
  }, [db, refresh]);

  const add = async (text: string) => {
    if (!productKey(text)) return;
    const added = await addListItem(db, text);
    if (!added) showToast('Déjà dans ta liste');
    setName('');
    refresh();
  };

  const toggle = async (line: ListLine) => {
    await setListDone(db, line.id, !line.done);
    if (!line.done && plan.todo === 1) showToast('Tbarkellah, liste terminée !');
    refresh();
  };

  const typed = productKey(name);
  const inList = new Set(plan.lines.map((l) => productKey(l.name)));
  const suggestions = products
    .filter((p) => !inList.has(productKey(p.name)) && !/timbre/i.test(p.name))
    .filter((p) => typed.length >= 2 && productKey(p.name).includes(typed))
    .slice(0, 6);
  const done = plan.lines.filter((l) => l.done).length;
  const stores = plan.stores.slice(0, 3);
  const shown = stores.find((x) => x.store === sel) ?? stores[0];
  const first = stores[0];
  // A saving is only meaningful between two stores that both have every article.
  const full = stores.filter((x) => x.covered === plan.todo);
  const dearest = full.length > 1 ? full[full.length - 1] : null;

  return (
    <Screen bottomBar="list">
      <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <View style={st.head}>
            <Text style={st.h1}>Ta liste</Text>
            <Text style={t.meta}>
              {plural(plan.lines.length, 'article', 'articles')}
              {done > 0 ? ` · ${done} pris` : ''}
            </Text>
          </View>

          {plan.todo > 0 && first && shown ? (
            <Pop>
              <View style={st.hero}>
                <Text style={st.heroMeta}>
                  {shown === first ? (first.covered === plan.todo ? 'Pour tout acheter au même endroit' : 'Le magasin qui a le plus de ta liste') : 'Si tu vas chez'}
                </Text>
                <Text style={st.heroStore} numberOfLines={1}>{shown.store}</Text>
                <Text style={st.heroTotal} adjustsFontSizeToFit numberOfLines={1}>
                  {money(shown.total)} <Text style={st.heroUnit}>DH</Text>
                </Text>
                <Text style={st.heroLine}>
                  {shown.covered === plan.todo
                    ? shown === first && dearest && dearest.total - first.total > 0.005
                      ? `Tu gardes ${money(dearest.total - first.total)} DH par rapport à ${dearest.store}.`
                      : `Tu y as déjà acheté tous tes articles.`
                    : `Prix connus pour ${shown.covered} de tes ${plan.todo} articles.`}
                </Text>
                {stores.length > 1 ? (
                  <View style={st.storeBtns}>
                    {stores.map((x) => {
                      const on = x.store === shown.store;
                      return (
                        <Pressable
                          key={x.store}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={`${x.store}, ${money(x.total)} DH pour ${x.covered} articles sur ${plan.todo}`}
                          onPress={() => setSel(x.store)}
                          style={({ pressed }) => [st.storeBtn, on && st.storeBtnOn, pressed && ui.pressed]}
                        >
                          <Text style={[st.storeBtnName, on && st.storeBtnTextOn]} numberOfLines={1}>{x.store}</Text>
                          <Text style={[st.storeBtnTotal, on && st.storeBtnTextOn]}>
                            {money(x.total)}
                            {x.covered < plan.todo ? ` · ${x.covered}/${plan.todo}` : ''}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                <Text style={st.heroSmall}>Avec tes derniers prix, pour 1 pièce ou 1 kg de chaque article.</Text>
              </View>
            </Pop>
          ) : plan.todo > 0 ? (
            <Card style={st.note}>
              <Text style={t.meta}>Tu n'as encore noté aucun prix pour ces articles. Après ta prochaine course, je te dirai quel magasin est le moins cher.</Text>
            </Card>
          ) : null}

          {plan.lines.length === 0 ? (
            <View style={st.gap}>
              <Empty title="Ta liste est vide" text="Écris ce qu'il te faut juste en dessous. Pour chaque article, tu verras où tu l'as payé le moins cher." />
            </View>
          ) : (
            <ListGroup style={st.lines}>
              {plan.lines.map((l, i) => {
                const here = shown ? l.prices[shown.store] : undefined;
                const price = here ?? l.best?.price;
                const at = here !== undefined && shown ? shown.store : l.best?.store;
                return (
                  <View key={l.id} style={[st.line, !!l.done && st.lineDone]}>
                    {i > 0 ? <View style={st.divider} /> : null}
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!l.done }} accessibilityLabel={l.name} onPress={() => toggle(l)} style={({ pressed }) => [st.lineMain, pressed && st.linePressed]}>
                      <View style={[st.box, !!l.done && st.boxOn]}>{l.done ? <Icon name="checkmark" size={18} color={colors.white} /> : null}</View>
                      <View style={st.lineText}>
                        <Text style={[st.lineName, !!l.done && st.struck]} numberOfLines={1}>{l.name}</Text>
                        <Text style={[t.meta, !l.done && !!at && !!l.best && at === l.best.store && st.best]} numberOfLines={1}>
                          {l.done ? 'pris' : at ? (l.best && at === l.best.store ? `${at} · le moins cher` : at) : 'pas de prix'}
                        </Text>
                      </View>
                      {price !== undefined ? <Text style={[st.linePrice, !!l.done && st.muted]}>{money(price)}</Text> : null}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer ${l.name} de la liste`}
                      onPress={async () => {
                        await removeListItem(db, l.id);
                        refresh();
                      }}
                      style={({ pressed }) => [st.remove, pressed && ui.pressed]}
                    >
                      <Icon name="close" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                );
              })}
            </ListGroup>
          )}

          <View style={st.addRow}>
            <TextInput
              accessibilityLabel="Article à ajouter à la liste"
              value={name}
              onChangeText={setName}
              onSubmitEditing={() => add(name)}
              placeholder="Zid chi haja…"
              placeholderTextColor={colors.muted}
              style={st.input}
              autoCapitalize="sentences"
              returnKeyType="done"
              blurOnSubmit={false}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Ajouter à la liste" onPress={() => add(name)} style={({ pressed }) => [st.add, pressed && ui.pressed]}>
              <Icon name="add" size={24} color={colors.white} />
            </Pressable>
          </View>
          {suggestions.length > 0 ? (
            <View style={st.wrap}>
              {suggestions.map((p) => (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Ajouter ${p.name}`} onPress={() => add(p.name)} style={({ pressed }) => [st.chip, pressed && ui.pressed]}>
                  <Icon name="add" size={14} color={colors.softText} />
                  <Text style={st.chipText}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {done > 0 ? (
            <Button
              label={`Retirer ${plural(done, "l'article coché", 'les articles cochés').replace(/^\d+ /, '')}`}
              icon="trash-outline"
              tone="light"
              style={st.gap}
              onPress={async () => {
                await clearListDone(db);
                refresh();
              }}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = sheet(() => ({
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xxl },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  h1: { fontFamily: fonts.titleBold, fontSize: type.h1, letterSpacing: -0.6, color: colors.ink },
  hero: { backgroundColor: colors.blue, ...bubble(radius.lg), padding: space.xl, gap: space.xs, marginTop: space.lg },
  heroMeta: { fontFamily: fonts.body, fontSize: type.caption, color: colors.onBlue },
  heroStore: { fontFamily: fonts.titleBold, fontSize: type.title, color: colors.white },
  heroTotal: { fontFamily: fonts.titleBold, fontSize: type.priceHero, letterSpacing: -1.5, color: colors.white, ...tabular },
  heroUnit: { fontFamily: fonts.bodyMedium, fontSize: type.title, color: colors.onBlue },
  heroLine: { fontFamily: fonts.body, fontSize: type.body, color: colors.white },
  heroSmall: { fontFamily: fonts.body, fontSize: type.caption, color: colors.onBlue, marginTop: space.sm },
  storeBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  storeBtn: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.onBlue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
  storeBtnOn: { backgroundColor: colors.white, borderColor: colors.white },
  storeBtnName: { fontFamily: fonts.bodyBold, fontSize: type.caption, color: colors.white },
  storeBtnTotal: { fontFamily: fonts.body, fontSize: type.caption, color: colors.white, ...tabular },
  storeBtnTextOn: { color: colors.blue },
  note: { marginTop: space.lg },
  gap: { marginTop: space.lg },
  lines: { marginTop: space.lg },
  line: { flexDirection: 'row', alignItems: 'center' },
  divider: { position: 'absolute', top: 0, right: 0, left: space.lg + 24 + space.md, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  linePressed: { backgroundColor: colors.cardPressed },
  lineText: { flex: 1, minWidth: 0 },
  best: { color: colors.softText, fontFamily: fonts.bodyBold },
  lineDone: { backgroundColor: colors.soft },
  lineMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingLeft: space.lg, paddingVertical: space.sm },
  box: { width: 24, height: 24, borderRadius: radius.sm, borderBottomLeftRadius: space.xs, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  lineName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.ink },
  struck: { textDecorationLine: 'line-through', color: colors.muted, fontFamily: fonts.body },
  linePrice: { minWidth: 56, textAlign: 'right', fontFamily: fonts.titleBold, fontSize: type.title, color: colors.ink, ...tabular },
  muted: { color: colors.muted },
  remove: { width: 44, height: 56, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.barSoft, backgroundColor: colors.card, paddingLeft: space.lg, paddingRight: space.sm, minHeight: 56 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: type.bodyLg, color: colors.ink, paddingVertical: space.sm },
  add: { width: 44, height: 44, ...bubble(radius.md), backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: colors.soft, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 44 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.softText },
}));
