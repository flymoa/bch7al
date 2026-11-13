// Shopping list: what to buy next time, what each article costs where, and the store
// that suits the list best according to the prices already noted.
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Pop } from '@/components/motion';
import { showToast } from '@/components/toast';
import { Button, Card, Empty, Screen, s as ui, t } from '@/components/ui';
import { addListItem, clearListDone, listPlan, listProducts, removeListItem, setListDone, type ListLine, type ListPlan, type ProductRow } from '@/db';
import { money, plural, productKey } from '@/format';
import { colors, fonts, sheet, useTheme } from '@/theme';

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
                  {shown === first ? (first.covered === plan.todo ? 'Tout au même endroit, le moins cher c\'est' : 'Le magasin qui a le plus de ta liste') : 'Si tu vas chez'}
                </Text>
                <View style={st.heroRow}>
                  <Text style={st.heroStore} numberOfLines={1}>{shown.store}</Text>
                  <Text style={st.heroTotal}>
                    {money(shown.total)} <Text style={st.heroUnit}>MAD</Text>
                  </Text>
                </View>
                <Text style={st.heroLine}>
                  {shown.covered === plan.todo
                    ? shown === first && dearest && dearest.total - first.total > 0.005
                      ? `Tu gardes ${money(dearest.total - first.total)} MAD par rapport à ${dearest.store}.`
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
                          accessibilityLabel={`${x.store}, ${money(x.total)} MAD pour ${x.covered} articles sur ${plan.todo}`}
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
            <View style={st.lines}>
              {plan.lines.map((l) => {
                const here = shown ? l.prices[shown.store] : undefined;
                const price = here ?? l.best?.price;
                const at = here !== undefined && shown ? shown.store : l.best?.store;
                return (
                  <View key={l.id} style={[st.line, !!l.done && st.lineDone]}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!l.done }} accessibilityLabel={l.name} onPress={() => toggle(l)} style={st.lineMain}>
                      <View style={[st.box, !!l.done && st.boxOn]}>{l.done ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}</View>
                      <Text style={[st.lineName, !!l.done && st.struck]} numberOfLines={1}>{l.name}</Text>
                      {l.done ? (
                        <Text style={t.meta}>pris</Text>
                      ) : at ? (
                        <View style={[st.storeChip, l.best && at === l.best.store && st.storeChipBest]}>
                          <Text style={[st.storeChipText, l.best && at === l.best.store && st.storeChipTextBest]} numberOfLines={1}>{at}</Text>
                        </View>
                      ) : (
                        <Text style={t.meta}>pas de prix</Text>
                      )}
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
                      <Ionicons name="close" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          <View style={st.addRow}>
            <TextInput
              accessibilityLabel="Article à ajouter à la liste"
              value={name}
              onChangeText={setName}
              onSubmitEditing={() => add(name)}
              placeholder="Zid chi haja… (ajouter)"
              placeholderTextColor={colors.muted}
              style={st.input}
              autoCapitalize="sentences"
              returnKeyType="done"
              blurOnSubmit={false}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Ajouter à la liste" onPress={() => add(name)} style={({ pressed }) => [st.add, pressed && ui.pressed]}>
              <Ionicons name="add" size={24} color={colors.white} />
            </Pressable>
          </View>
          {suggestions.length > 0 ? (
            <View style={st.wrap}>
              {suggestions.map((p) => (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Ajouter ${p.name}`} onPress={() => add(p.name)} style={({ pressed }) => [st.chip, pressed && ui.pressed]}>
                  <Ionicons name="add" size={14} color={colors.softText} />
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
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  h1: { fontFamily: fonts.titleBold, fontSize: 30, letterSpacing: -0.5, color: colors.ink },
  hero: { backgroundColor: colors.night, borderRadius: 28, padding: 18, gap: 4, marginTop: 14 },
  heroMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.onNight },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  heroStore: { flexShrink: 1, fontFamily: fonts.titleBold, fontSize: 38, letterSpacing: -1, color: colors.white },
  heroTotal: { fontFamily: fonts.titleBold, fontSize: 26, color: colors.white },
  heroUnit: { fontFamily: fonts.title, fontSize: 14, color: colors.onNight },
  heroLine: { fontFamily: fonts.body, fontSize: 14, color: colors.white },
  heroSmall: { fontFamily: fonts.body, fontSize: 12, color: colors.onNight, marginTop: 8 },
  storeBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  storeBtn: { flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: colors.nightBlue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  storeBtnOn: { backgroundColor: colors.white, borderColor: colors.white },
  storeBtnName: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#E6EDFF' },
  storeBtnTotal: { fontFamily: fonts.body, fontSize: 13, color: '#E6EDFF' },
  storeBtnTextOn: { color: '#0B1B4D' },
  note: { marginTop: 14 },
  gap: { marginTop: 14 },
  lines: { gap: 6, marginTop: 14 },
  line: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, paddingLeft: 14 },
  lineDone: { backgroundColor: colors.soft },
  lineMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  lineName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  struck: { textDecorationLine: 'line-through', color: colors.muted, fontFamily: fonts.body },
  storeChip: { height: 26, maxWidth: 96, borderRadius: 13, paddingHorizontal: 10, justifyContent: 'center', backgroundColor: colors.neutral },
  storeChipBest: { backgroundColor: colors.soft },
  storeChipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted },
  storeChipTextBest: { color: colors.softText },
  linePrice: { width: 54, textAlign: 'right', fontFamily: fonts.title, fontSize: 15, color: colors.ink },
  muted: { color: colors.muted },
  remove: { width: 40, height: 52, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.muted, paddingLeft: 16, paddingRight: 6, minHeight: 56 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, paddingVertical: 10 },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.soft, borderRadius: 18, paddingHorizontal: 12, minHeight: 36 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.softText },
}));
