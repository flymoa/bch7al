// Shopping list: what to buy next time, what each article costs where, and the store
// that suits the list best according to the prices already noted.
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Pop } from '@/components/motion';
import { showToast } from '@/components/toast';
import { Button, Card, Empty, Header, Screen, Tile, s as ui, t } from '@/components/ui';
import { addListItem, clearListDone, listPlan, listProducts, removeListItem, setListDone, type ListLine, type ListPlan, type ProductRow } from '@/db';
import { money, plural, productKey } from '@/format';
import { colors, fonts, sheet, useTheme } from '@/theme';

export default function ShoppingList() {
  useTheme();
  const db = useSQLiteContext();
  const [plan, setPlan] = useState<ListPlan>({ lines: [], stores: [], todo: 0, known: 0 });
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [name, setName] = useState('');

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
    .filter((p) => (typed.length >= 2 ? productKey(p.name).includes(typed) : plan.lines.length === 0))
    .slice(0, 6);
  const done = plan.lines.filter((l) => l.done).length;
  const first = plan.stores[0];
  const second = plan.stores[1];

  return (
    <Screen>
      <Header title="Ma liste" />
      <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <View style={st.addRow}>
            <TextInput
              accessibilityLabel="Article à ajouter à la liste"
              value={name}
              onChangeText={setName}
              onSubmitEditing={() => add(name)}
              placeholder="Qu'est-ce qu'il te faut ?"
              placeholderTextColor={colors.muted}
              style={st.input}
              autoCapitalize="sentences"
              returnKeyType="done"
              blurOnSubmit={false}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Ajouter à la liste" onPress={() => add(name)} style={({ pressed }) => [st.add, pressed && ui.pressed]}>
              <Ionicons name="add" size={28} color={colors.white} />
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

          {plan.todo > 0 && first ? (
            <Pop>
              <View style={st.hero}>
                <Text style={st.heroMeta}>Pour cette liste, va chez</Text>
                <Text style={st.heroStore}>{first.store}</Text>
                <Text style={st.heroMeta}>
                  {first.covered === plan.todo
                    ? `Tu y as déjà acheté tous tes articles`
                    : `Tu y as déjà acheté ${first.covered} de tes ${plan.todo} articles`}
                  , pour environ {money(first.total)} MAD{first.cheapest > 0 ? ` · le moins cher pour ${plural(first.cheapest, 'article', 'articles')}` : ''}.
                </Text>
                {second ? (
                  <Text style={st.heroSecond}>
                    Sinon : {second.store}, {plural(second.covered, 'article', 'articles')} pour {money(second.total)} MAD
                  </Text>
                ) : null}
                <Text style={st.heroSmall}>Calculé avec tes derniers prix, pour 1 pièce ou 1 kg de chaque article.</Text>
              </View>
            </Pop>
          ) : plan.todo > 0 ? (
            <Card style={st.note}>
              <Text style={t.meta}>Tu n'as encore noté aucun prix pour ces articles. Après ta prochaine course, je te dirai quel magasin est le moins cher.</Text>
            </Card>
          ) : null}

          {plan.lines.length === 0 ? (
            <View style={st.gap}>
              <Empty title="Ta liste est vide" text="Écris ce qu'il te faut. Pour chaque article, tu verras où tu l'as payé le moins cher." />
            </View>
          ) : (
            <View style={st.lines}>
              {plan.lines.map((l) => (
                <Card key={l.id} style={[st.line, !!l.done && st.lineDone]}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!l.done }}
                    accessibilityLabel={l.name}
                    onPress={() => toggle(l)}
                    style={st.lineMain}
                  >
                    <View style={[st.box, !!l.done && st.boxOn]}>{l.done ? <Ionicons name="checkmark" size={20} color={colors.white} /> : null}</View>
                    <Tile text={l.name} size={38} />
                    <View style={ui.flex}>
                      <Text style={[t.name, !!l.done && st.struck]} numberOfLines={1}>{l.name}</Text>
                      <Text style={t.meta} numberOfLines={1}>
                        {l.best ? `${money(l.best.price)} MAD${l.unit && l.unit !== 'pièce' ? ` / ${l.unit}` : ''} chez ${l.best.store}` : 'Pas encore de prix'}
                      </Text>
                    </View>
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
                    <Ionicons name="close" size={20} color={colors.muted} />
                  </Pressable>
                </Card>
              ))}
            </View>
          )}

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
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 28 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 16, minHeight: 56, fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  add: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.soft, borderRadius: 18, paddingHorizontal: 12, minHeight: 36 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.softText },
  hero: { backgroundColor: colors.blue, borderRadius: 28, padding: 20, gap: 4, marginTop: 14 },
  heroMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.white, lineHeight: 20 },
  heroStore: { fontFamily: fonts.title, fontSize: 34, color: colors.white },
  heroSecond: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white, marginTop: 6 },
  heroSmall: { fontFamily: fonts.body, fontSize: 12, color: colors.white, opacity: 0.85, marginTop: 6 },
  note: { marginTop: 14 },
  gap: { marginTop: 14 },
  lines: { gap: 8, marginTop: 14 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingLeft: 12, paddingRight: 4 },
  lineDone: { opacity: 0.6 },
  lineMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  box: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  struck: { textDecorationLine: 'line-through' },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
}));
