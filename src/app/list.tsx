// Liste (tab): what to buy next, what each article costs where, and the store that suits
// the whole list best according to the prices already noted.
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Pop } from '@/components/motion';
import { showToast } from '@/components/toast';
import { Button, Empty, Field, Group, IconButton, Screen, ScreenTitle, s as ui, t } from '@/components/ui';
import { addListItem, clearListDone, listPlan, listProducts, removeListItem, setListDone, type ListLine, type ListPlan, type ProductRow } from '@/db';
import { money, moneyShort, plural, productKey } from '@/format';
import { useSQLiteContext } from '@/sqlite';
import { bubble, colors, sheet, text, useTheme } from '@/theme';
import { radius, size, space } from '@/tokens';

export default function ShoppingList() {
  useTheme();
  const db = useSQLiteContext();
  const [plan, setPlan] = useState<ListPlan>({ lines: [], stores: [], todo: 0, known: 0 });
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [name, setName] = useState('');
  const [sel, setSel] = useState<string | null>(null);

  const refresh = useCallback(async () => setPlan(await listPlan(db)), [db]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    listProducts(db, '', 'frequent').then(setProducts);
  }, [db, refresh]);

  const add = async (value: string) => {
    if (!productKey(value)) return;
    if (!(await addListItem(db, value))) showToast('Déjà dans ta liste');
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
    .filter((p) => (typed.length >= 2 ? productKey(p.name).includes(typed) : true))
    .slice(0, typed.length >= 2 ? 6 : 4);
  const done = plan.lines.filter((l) => l.done).length;
  const stores = plan.stores.slice(0, 3);
  const shown = stores.find((x) => x.store === sel) ?? stores[0];
  const first = stores[0];
  const full = stores.filter((x) => x.covered === plan.todo);
  const dearest = full.length > 1 ? full[full.length - 1] : null;

  return (
    <Screen tab="list">
      <KeyboardAvoidingView style={ui.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenTitle title="Ta liste" meta={plan.lines.length ? `${plural(plan.lines.length, 'article', 'articles')}${done ? ` · ${done} pris` : ''}` : undefined} />
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <View style={st.addRow}>
            <Field accessibilityLabel="Article à ajouter" value={name} onChangeText={setName} onSubmitEditing={() => add(name)} placeholder="Zid chi haja…" autoCapitalize="sentences" returnKeyType="done" submitBehavior="submit" style={ui.flex} />
            <IconButton icon="plus" label="Ajouter à la liste" tone="primary" onPress={() => add(name)} />
          </View>
          {suggestions.length > 0 ? (
            <View style={st.wrap}>
              {suggestions.map((p) => (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Ajouter ${p.name}`} onPress={() => add(p.name)} style={({ pressed }) => [st.suggest, pressed && ui.pressed]}>
                  <Icon name="plus" size={size.iconInline} color={colors.onPrimaryContainer} />
                  <Text style={st.suggestText} numberOfLines={1}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {plan.todo > 0 && first && shown ? (
            <Pop>
              <View style={st.hero}>
                <Text style={st.heroOver}>
                  {(shown === first ? (first.covered === plan.todo ? 'Tout au même endroit' : 'Le magasin qui a le plus de ta liste') : 'Si tu vas chez').toUpperCase()}
                </Text>
                <Text style={st.heroStore} numberOfLines={1}>{shown.store}</Text>
                <View style={st.heroRow}>
                  <Text style={st.heroTotal} adjustsFontSizeToFit numberOfLines={1}>{money(shown.total)}</Text>
                  <Text style={st.heroUnit}>DH</Text>
                </View>
                <Text style={st.heroLine}>
                  {shown.covered === plan.todo
                    ? shown === first && dearest && dearest.total - first.total > 0.005
                      ? `Tu gardes ${money(dearest.total - first.total)} DH par rapport à ${dearest.store}.`
                      : 'Tu y as déjà acheté tous tes articles.'
                    : `Prix connus pour ${shown.covered} de tes ${plan.todo} articles.`}
                </Text>
                {stores.length > 1 ? (
                  <View style={st.storeBtns}>
                    {stores.map((x) => {
                      const on = x.store === shown.store;
                      return (
                        <Pressable key={x.store} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${x.store}, ${money(x.total)} DH`} onPress={() => setSel(x.store)} style={[st.storeBtn, on && st.storeBtnOn]}>
                          <Text style={[st.storeName, on && st.storeOn]} numberOfLines={1}>{x.store}{x.covered < plan.todo ? ` · ${x.covered}/${plan.todo}` : ''}</Text>
                          <Text style={[st.storeTotal, on && st.storeOn]} numberOfLines={1} adjustsFontSizeToFit>{moneyShort(x.total)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                <Text style={st.heroSmall}>Avec tes derniers prix, pour 1 pièce ou 1 kg de chaque article.</Text>
              </View>
            </Pop>
          ) : null}

          {plan.lines.length === 0 ? (
            <Empty icon="list" darija="Chno khassk ?" title="Ta liste est vide" text="Écris ce qu'il te faut juste au-dessus. Pour chaque article, tu verras où tu l'as payé le moins cher." />
          ) : (
            <Group>
              {plan.lines.map((l, i) => {
                const here = shown ? l.prices[shown.store] : undefined;
                const p = here ?? l.best?.price;
                const at = here !== undefined && shown ? shown.store : l.best?.store;
                const cheapest = !!l.best && at === l.best.store;
                return (
                  <View key={l.id} style={st.line}>
                    {i > 0 ? <View style={st.hair} /> : null}
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!l.done }} accessibilityLabel={l.name} onPress={() => toggle(l)} style={({ pressed }) => [st.lineMain, pressed && ui.pressed]}>
                      <View style={[st.box, !!l.done && st.boxOn]}>{l.done ? <Icon name="check" size={size.iconInline} color={colors.onPrimary} weight="bold" /> : null}</View>
                      <View style={ui.flex}>
                        <Text style={[t.name, !!l.done && st.struck]} numberOfLines={1}>{l.name}</Text>
                        <Text style={[t.meta, !l.done && cheapest && st.best]} numberOfLines={1}>
                          {l.done ? 'pris' : at ? (cheapest ? `${at} · le moins cher` : at) : 'pas encore de prix'}
                        </Text>
                      </View>
                      {p !== undefined ? <Text style={[t.price, !!l.done && st.dim]}>{money(p)}</Text> : null}
                    </Pressable>
                    <IconButton icon="close" label={`Retirer ${l.name}`} onPress={async () => { await removeListItem(db, l.id); refresh(); }} />
                  </View>
                );
              })}
            </Group>
          )}
          {done > 0 ? <Button kind="outline" icon="delete" label={done > 1 ? 'Retirer les articles cochés' : "Retirer l'article coché"} onPress={async () => { await clearListDone(db); refresh(); }} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = sheet(() => ({
  content: { paddingHorizontal: size.screen, paddingBottom: space.section, gap: space.md },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.primaryContainer, maxWidth: '100%' },
  suggestText: { ...text('labelSm'), color: colors.onPrimaryContainer },
  hero: { backgroundColor: colors.hero, ...bubble('hero'), padding: space.xxl, gap: space.xs },
  heroOver: { ...text('overline'), color: colors.onHeroMuted },
  heroStore: { ...text('headlineSm'), color: colors.onHero },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  heroTotal: { ...text('display'), color: colors.onHero, flexShrink: 1 },
  heroUnit: { ...text('title'), color: colors.onHeroMuted },
  heroLine: { ...text('bodySm'), color: colors.onHero },
  heroSmall: { ...text('caption'), color: colors.onHeroMuted, marginTop: space.sm },
  storeBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  storeBtn: { flex: 1, minHeight: size.touch + 8, borderRadius: radius.md, backgroundColor: colors.heroRaised, paddingHorizontal: space.md, paddingVertical: space.sm, justifyContent: 'center' },
  storeBtnOn: { backgroundColor: colors.onHero },
  storeName: { ...text('labelSm'), color: colors.onHeroMuted },
  storeTotal: { ...text('priceRow'), color: colors.onHero },
  storeOn: { color: colors.hero },
  line: { flexDirection: 'row', alignItems: 'center', paddingRight: space.xs },
  hair: { position: 'absolute', top: 0, left: space.lg + 28 + space.md, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  lineMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.row, paddingLeft: space.lg, paddingRight: space.sm },
  box: { width: 28, height: 28, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
  best: { color: colors.sky, fontFamily: text('label').fontFamily },
  dim: { color: colors.muted },
}));
