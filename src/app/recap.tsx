// "Ton mois" : one month told in a few lines.
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CountUp, FadeIn } from '@/components/motion';
import { Button, Card, Empty, Header, Screen, t } from '@/components/ui';
import { monthRecap, type MonthRecap } from '@/db';
import { currentMonth, money, monthLabel, pct, pctChange, plural } from '@/format';
import { bubble, colors, fonts, sheet, useTheme } from '@/theme';
import { radius, space, tabular, type } from '@/tokens';

// One fact = a muted label over the thing itself. No decorative icon tile: the number or name is the hero.
// "warm" (prices went up) = ink outline, never a warm colour.
function Fact({ label, index, warm, children }: { label: string; index: number; warm?: boolean; children: ReactNode }) {
  return (
    <FadeIn index={index}>
      <Card outlined={warm} style={st.fact}>
        <Text style={t.label}>{label}</Text>
        {children}
      </Card>
    </FadeIn>
  );
}

export default function Recap() {
  useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ month?: string }>();
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonth();
  const [r, setR] = useState<MonthRecap | null>(null);

  useEffect(() => {
    monthRecap(db, month).then(setR);
  }, [db, month]);

  const vsPrev = r ? pctChange(r.prevTotal, r.total) : null;

  return (
    <Screen>
      <Header title="Ton mois" />
      {r === null ? null : r.trips === 0 ? (
        <Empty
          title={`Rien de noté en ${monthLabel(month).toLowerCase()}`}
          text="Note tes courses, et ton résumé du mois se remplira tout seul."
          action={{ label: 'Nouvelle course', icon: 'add', onPress: () => router.push('/trip/new') }}
        />
      ) : (
        <ScrollView contentContainerStyle={st.content}>
          <FadeIn>
            <View style={st.hero}>
              <Text style={st.heroMonth}>{monthLabel(month)}</Text>
              <View style={st.heroRow}>
                <CountUp style={st.heroTotal} value={r.total} format={money} />
                <Text style={st.heroUnit}>DH</Text>
              </View>
              <Text style={st.heroMeta}>
                {plural(r.trips, 'course', 'courses')} · {plural(r.items, 'article', 'articles')}
                {vsPrev !== null ? ` · ${vsPrev >= 0 ? '+' : '−'}${pct(vsPrev)} par rapport au mois d'avant` : ''}
              </Text>
            </View>
          </FadeIn>

          {r.mainStore ? (
            <Fact label="Ton magasin du mois" index={1}>
              <Text style={st.name} numberOfLines={1}>{r.mainStore.store}</Text>
              <Text style={t.meta}>{money(r.mainStore.total)} DH en {plural(r.mainStore.trips, 'course', 'courses')}</Text>
            </Fact>
          ) : null}

          <Fact label="Celui qui t'a fait économiser" index={2}>
            {r.bestStore ? (
              <>
                <Text style={st.name} numberOfLines={1}>{r.bestStore.store}</Text>
                <Text style={t.meta}>Environ {money(r.bestStore.saved)} DH de moins que les mêmes produits ailleurs.</Text>
              </>
            ) : (
              <Text style={st.plain}>Pas encore assez de prix pour comparer : achète un même produit dans deux magasins.</Text>
            )}
          </Fact>

          <Fact label="La plus forte hausse" index={3} warm={!!r.rise}>
            {r.rise ? (
              <>
                <Text style={st.name} numberOfLines={1}>{r.rise.name}</Text>
                <Text style={st.num}>+{pct(r.rise.change)}</Text>
                <Text style={t.meta}>{money(r.rise.before)} → {money(r.rise.now)} DH</Text>
              </>
            ) : (
              <Text style={st.plain}>Aucun de tes produits n'a augmenté. Hamdoullah !</Text>
            )}
          </Fact>

          {r.drop ? (
            <Fact label="La bonne surprise" index={4}>
              <Text style={st.name} numberOfLines={1}>{r.drop.name}</Text>
              <Text style={st.num}>−{pct(r.drop.change)}</Text>
              <Text style={t.meta}>{money(r.drop.before)} → {money(r.drop.now)} DH</Text>
            </Fact>
          ) : null}

          {r.inflation !== null ? (
            <Fact label="Tes prix, en moyenne" index={5} warm={r.inflation > 0.05}>
              <Text style={st.num}>{r.inflation >= 0 ? '+' : '−'}{pct(r.inflation)}</Text>
              <Text style={t.meta}>Par rapport à ton achat précédent de chaque produit.</Text>
            </Fact>
          ) : null}

          <Button label="Voir le détail du mois" icon="stats-chart-outline" tone="light" style={st.gap} onPress={() => router.replace('/stats')} />
        </ScrollView>
      )}
    </Screen>
  );
}

const st = sheet(() => ({
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.md },
  hero: { backgroundColor: colors.blue, ...bubble(radius.lg), padding: space.xl, gap: space.xs },
  heroMonth: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.white },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  heroTotal: { fontFamily: fonts.titleBold, fontSize: type.priceHero, color: colors.white, ...tabular },
  heroUnit: { fontFamily: fonts.bodyBold, fontSize: type.bodyLg, color: colors.white },
  heroMeta: { fontFamily: fonts.body, fontSize: type.body, color: colors.white, lineHeight: type.body + space.sm },
  fact: { gap: space.xs },
  name: { fontFamily: fonts.title, fontSize: type.title, color: colors.ink },
  num: { fontFamily: fonts.titleBold, fontSize: type.price, color: colors.ink, ...tabular },
  plain: { fontFamily: fonts.body, fontSize: type.body, color: colors.ink, lineHeight: type.body + space.sm },
  gap: { marginTop: space.sm },
}));
