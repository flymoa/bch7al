// "Ton mois" : one month told in a few lines.
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from '@/sqlite';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CountUp, FadeIn } from '@/components/motion';
import { Button, Card, Empty, Header, Screen, s as ui, t } from '@/components/ui';
import { monthRecap, type MonthRecap } from '@/db';
import { currentMonth, money, monthLabel, pct, pctChange, plural } from '@/format';
import { colors, fonts, sheet, useTheme } from '@/theme';

function Fact({ icon, label, index, warm, children }: { icon: string; label: string; index: number; warm?: boolean; children: ReactNode }) {
  return (
    <FadeIn index={index}>
      <Card style={st.fact}>
        <View style={[st.factIcon, warm && { backgroundColor: colors.upBg }, warm && ui.upBox]}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={22} color={warm ? colors.upText : colors.softText} />
        </View>
        <View style={ui.flex}>
          <Text style={t.label}>{label}</Text>
          {children}
        </View>
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
        <Empty title={`Rien de noté en ${monthLabel(month).toLowerCase()}`} text="Note tes courses, et ton résumé du mois se remplira tout seul." />
      ) : (
        <ScrollView contentContainerStyle={st.content}>
          <FadeIn>
            <View style={st.hero}>
              <Text style={st.heroMonth}>{monthLabel(month)}</Text>
              <View style={st.heroRow}>
                <CountUp style={st.heroTotal} value={r.total} format={money} />
                <Text style={st.heroUnit}>MAD</Text>
              </View>
              <Text style={st.heroMeta}>
                {plural(r.trips, 'course', 'courses')} · {plural(r.items, 'article', 'articles')}
                {vsPrev !== null ? ` · ${vsPrev >= 0 ? '+' : '−'}${pct(vsPrev)} par rapport au mois d'avant` : ''}
              </Text>
            </View>
          </FadeIn>

          {r.mainStore ? (
            <Fact icon="storefront-outline" label="Ton magasin du mois" index={1}>
              <Text style={st.big}>{r.mainStore.store}</Text>
              <Text style={t.meta}>{money(r.mainStore.total)} MAD en {plural(r.mainStore.trips, 'course', 'courses')}</Text>
            </Fact>
          ) : null}

          <Fact icon="wallet-outline" label="Celui qui t'a fait économiser" index={2}>
            {r.bestStore ? (
              <>
                <Text style={st.big}>{r.bestStore.store}</Text>
                <Text style={t.meta}>Environ {money(r.bestStore.saved)} MAD de moins que les mêmes produits ailleurs.</Text>
              </>
            ) : (
              <Text style={st.plain}>Pas encore assez de prix pour comparer : achète un même produit dans deux magasins.</Text>
            )}
          </Fact>

          <Fact icon="trending-up" label="La plus forte hausse" index={3} warm={!!r.rise}>
            {r.rise ? (
              <>
                <Text style={st.big}>{r.rise.name}</Text>
                <Text style={t.meta}>+{pct(r.rise.change)} · {money(r.rise.before)} → {money(r.rise.now)} MAD</Text>
              </>
            ) : (
              <Text style={st.plain}>Aucun de tes produits n'a augmenté. Hamdoullah !</Text>
            )}
          </Fact>

          {r.drop ? (
            <Fact icon="trending-down" label="La bonne surprise" index={4}>
              <Text style={st.big}>{r.drop.name}</Text>
              <Text style={t.meta}>−{pct(r.drop.change)} · {money(r.drop.before)} → {money(r.drop.now)} MAD</Text>
            </Fact>
          ) : null}

          {r.inflation !== null ? (
            <Fact icon="pulse-outline" label="Tes prix, en moyenne" index={5} warm={r.inflation > 0.05}>
              <Text style={st.big}>{r.inflation >= 0 ? '+' : '−'}{pct(r.inflation)}</Text>
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
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 28, gap: 10 },
  hero: { backgroundColor: colors.night, borderRadius: 28, padding: 22, gap: 2 },
  heroMonth: { fontFamily: fonts.title, fontSize: 20, color: colors.white },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroTotal: { fontFamily: fonts.title, fontSize: 50, color: colors.white },
  heroUnit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  heroMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.white, lineHeight: 20 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  factIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  big: { fontFamily: fonts.title, fontSize: 20, color: colors.ink },
  plain: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, lineHeight: 20, marginTop: 2 },
  gap: { marginTop: 6 },
}));
