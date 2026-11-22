// Réglages: backup first (data lives only on this phone), then budget, Gemini, appearance.
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Alert } from '@/alert';
import { Mark } from '@/components/brand';
import { Icon, type IconName } from '@/components/icon';
import { Button, Field, Pill, Screen, TopBar, t } from '@/components/ui';
import { counts, exportCsv, getPref, importCsv, schemaInfo, setPref as savePref } from '@/db';
import { geminiCheck } from '@/gemini';
import { longDate, money, parseNumber, plural, todayIso } from '@/format';
import { useSQLiteContext } from '@/sqlite';
import { colors, sheet, text, useTheme } from '@/theme';
import { radius, size, space } from '@/tokens';

function Section({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <View style={st.card}>
      <View style={st.cardHead}>
        <Icon name={icon} color={colors.primary} />
        <Text style={st.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function Settings() {
  const { pref, setPref, scheme } = useTheme();
  const db = useSQLiteContext();
  const [stats, setStats] = useState({ trips: 0, products: 0, items: 0 });
  const [busy, setBusy] = useState(false);
  const [budget, setBudget] = useState('');
  const [budgetSaved, setBudgetSaved] = useState('');
  const [visionKey, setVisionKey] = useState('');
  const [visionSaved, setVisionSaved] = useState(false);
  const [visionMsg, setVisionMsg] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [schema, setSchema] = useState<{ version: number; ok: boolean } | null>(null);

  useEffect(() => {
    getPref(db, 'geminiKey').then((k) => {
      setVisionKey(k ?? '');
      setVisionSaved(!!k);
    });
    getPref(db, 'geminiModel').then(setModel);
  }, [db]);

  const saveVision = async () => {
    const k = visionKey.trim();
    if (!k) {
      await savePref(db, 'geminiKey', '');
      setVisionSaved(false);
      setVisionMsg('Clé retirée : les tickets sont lus sur le téléphone.');
      return;
    }
    setBusy(true);
    setVisionMsg('Vérification de la clé…');
    try {
      const used = await geminiCheck(k);
      await savePref(db, 'geminiKey', k);
      await savePref(db, 'geminiModel', used);
      setModel(used);
      setVisionSaved(true);
      setVisionMsg('Clé valide. Les tickets seront lus avec Gemini (français et arabe).');
    } catch (e) {
      setVisionSaved(false);
      setVisionMsg(`La clé ne marche pas : ${String((e as Error).message ?? e)}`);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    getPref(db, 'budget').then((v) => {
      const txt = v ? money(Number(v)).replace(',00', '') : '';
      setBudget(txt);
      setBudgetSaved(txt);
    });
  }, [db]);

  const saveBudget = async () => {
    const clean = budget.trim();
    if (!clean) {
      await savePref(db, 'budget', '');
      setBudgetSaved('');
      return Alert.alert('Budget retiré', "L'accueil n'affiche plus de budget.");
    }
    const v = parseNumber(clean);
    if (!(v > 0)) return Alert.alert('Montant invalide', 'Écris un montant, par exemple 2000.');
    await savePref(db, 'budget', String(v));
    setBudget(money(v).replace(',00', ''));
    setBudgetSaved(money(v).replace(',00', ''));
  };

  const refresh = useCallback(async () => {
    setStats(await counts(db));
    setLastBackup(await getPref(db, 'lastBackup'));
    setSchema(await schemaInfo(db).catch(() => null));
  }, [db]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const doExport = async () => {
    if (stats.items === 0) return Alert.alert('Rien à sauvegarder', "Tu n'as pas encore enregistré de course.");
    setBusy(true);
    try {
      const { csv } = await exportCsv(db);
      const file = new File(Paths.cache, `bch7al-${todayIso()}.csv`);
      file.create({ overwrite: true });
      // The BOM makes Excel read accents correctly.
      file.write('﻿' + csv);
      if (!(await Sharing.isAvailableAsync())) throw new Error("Le partage de fichiers n'est pas disponible sur cet appareil.");
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Sauvegarder mes courses' });
      await savePref(db, 'lastBackup', todayIso());
      setLastBackup(todayIso());
    } catch (e) {
      Alert.alert('La sauvegarde a échoué', String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (picked.canceled) return;
      const text = await new File(picked.assets[0].uri).text();
      Alert.alert(
        'Remplacer toutes les données ?',
        `Les ${plural(stats.trips, 'course enregistrée', 'courses enregistrées')} dans l'application seront remplacées par le contenu de « ${picked.assets[0].name} ».`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Remplacer',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                const res = await importCsv(db, text);
                await refresh();
                Alert.alert('Sauvegarde restaurée', `${plural(res.trips, 'course', 'courses')} et ${plural(res.items, 'article', 'articles')}.`);
              } catch (e) {
                Alert.alert('Fichier illisible', `Rien n'a été modifié. ${String((e as Error).message ?? e)}`);
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert("L'ouverture du fichier a échoué", String((e as Error).message ?? e));
    }
  };

  return (
    <Screen>
      <TopBar title="Réglages" />
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <Section icon="export" title="Mes données">
          <View style={st.counts}>
            {[
              [stats.trips, stats.trips > 1 ? 'courses' : 'course'],
              [stats.products, stats.products > 1 ? 'produits' : 'produit'],
              [stats.items, stats.items > 1 ? 'prix notés' : 'prix noté'],
            ].map(([n, l]) => (
              <View key={String(l)} style={st.count}>
                <Text style={st.countNum}>{n}</Text>
                <Text style={t.meta}>{l}</Text>
              </View>
            ))}
          </View>
          <Text style={t.body}>
            Tout est sur ce téléphone, sans compte. Perdre le téléphone, c'est perdre l'historique : sauvegarde régulièrement vers Drive, ton e-mail ou WhatsApp. Le fichier s'ouvre aussi dans Excel.
          </Text>
          <Text style={st.status}>{lastBackup ? `Dernière sauvegarde : ${longDate(lastBackup)}` : 'Aucune sauvegarde pour le moment'}</Text>
          <Button label="Sauvegarder mes courses" icon="export" onPress={doExport} disabled={busy} />
          <Button label="Restaurer une sauvegarde" icon="import" kind="outline" onPress={doImport} disabled={busy} />
        </Section>

        <Section icon="money" title="Budget du mois">
          <Text style={t.body}>L'accueil montre combien il te reste. Laisse vide pour ne pas suivre de budget.</Text>
          <View style={st.inline}>
            <Field accessibilityLabel="Budget du mois en dirhams" value={budget} onChangeText={setBudget} placeholder="Ex. 2000" keyboardType="decimal-pad" onCard style={st.flex} />
            <Text style={st.mad}>DH</Text>
          </View>
          <Button label={budget.trim() === budgetSaved ? 'Budget enregistré' : 'Enregistrer le budget'} kind={budget.trim() === budgetSaved ? 'outline' : 'primary'} onPress={saveBudget} disabled={busy} />
        </Section>

        <Section icon="scan" title="Lecture des tickets (Gemini)">
          <Text style={t.body}>
            Avec une clé Gemini, la photo du ticket est lue en ligne par Google : noms en arabe, photos penchées, tickets groupés par rayon. Gratuit, sans carte bancaire. Sans clé ou sans internet, le téléphone lit le ticket lui-même.
          </Text>
          <Text style={t.body}>
            Pour la clé : aistudio.google.com → « Get API key » → « Create API key », puis colle-la ici. Avec la formule gratuite, Google peut utiliser les photos envoyées pour améliorer ses services : un ticket de caisse contient peu de choses privées, mais tu le sais.
          </Text>
          <Field
            accessibilityLabel="Clé Gemini"
            value={visionKey}
            onChangeText={(v) => { setVisionKey(v); setVisionMsg(''); }}
            placeholder="Colle ta clé ici (AIza…)"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={visionSaved && !visionMsg}
            onCard
          />
          <Button
            label={visionKey.trim() || !visionSaved ? 'Vérifier et enregistrer' : 'Retirer la clé'}
            kind={visionSaved && !visionMsg ? 'outline' : 'primary'}
            onPress={saveVision}
            disabled={busy || (!visionKey.trim() && !visionSaved)}
          />
          {visionMsg ? <Text style={st.status}>{visionMsg}</Text> : visionSaved ? <Text style={st.status}>Lecture Gemini activée{model ? ` · modèle ${model}` : ''}. Si la limite gratuite du jour est atteinte, l'app passe au modèle suivant puis au téléphone.</Text> : null}
        </Section>

        <Section icon={scheme === 'dark' ? 'moon' : 'sun'} title="Apparence">
          <View style={st.row}>
            <Pill label="Automatique" active={pref === 'system'} onPress={() => setPref('system')} />
            <Pill label="Clair" active={pref === 'light'} onPress={() => setPref('light')} />
            <Pill label="Sombre" active={pref === 'dark'} onPress={() => setPref('dark')} />
          </View>
          <Text style={t.meta}>Automatique suit le réglage de ton téléphone.</Text>
        </Section>

        <View style={st.about}>
          <Mark size={28} />
          <Text style={t.meta}>bch7al? · version {Constants.expoConfig?.version ?? '4.0.1'}{schema ? ` · base v${schema.version}${schema.ok ? '' : ' (à réparer)'}` : ''}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const st = sheet(() => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: size.screen, paddingBottom: space.section, gap: space.md },
  card: { backgroundColor: colors.surfaceContainer, borderRadius: radius.card, padding: space.lg, gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { ...text('title'), color: colors.ink },
  counts: { flexDirection: 'row', gap: space.sm },
  count: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: space.md, alignItems: 'center' },
  countNum: { ...text('headlineSm'), color: colors.ink },
  status: { ...text('bodySm'), fontFamily: text('label').fontFamily, color: colors.ink },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mad: { ...text('title'), color: colors.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  about: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.xxl },
}));
