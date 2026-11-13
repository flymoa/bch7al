import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TextInput } from 'react-native';
import { Alert } from '@/alert';
import { Button, Card, Header, Pill, Screen } from '@/components/ui';
import { counts, exportCsv, getPref, importCsv, setPref as savePref } from '@/db';
import { geminiCheck } from '@/gemini';
import { money, parseNumber, plural, todayIso } from '@/format';
import { colors, fonts, sheet, useTheme } from '@/theme';

export default function Settings() {
  const { pref, setPref } = useTheme();
  const db = useSQLiteContext();
  const [stats, setStats] = useState({ trips: 0, products: 0, items: 0 });
  const [busy, setBusy] = useState(false);
  const [budget, setBudget] = useState('');
  const [budgetSaved, setBudgetSaved] = useState('');
  const [who, setWho] = useState('');
  const [whoSaved, setWhoSaved] = useState('');
  const [visionKey, setVisionKey] = useState('');
  const [visionSaved, setVisionSaved] = useState(false);
  const [visionMsg, setVisionMsg] = useState('');

  useEffect(() => {
    getPref(db, 'name').then((n) => {
      setWho(n ?? '');
      setWhoSaved(n ?? '');
    });
    getPref(db, 'geminiKey').then((k) => {
      setVisionKey(k ?? '');
      setVisionSaved(!!k);
    });
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
      const model = await geminiCheck(k);
      await savePref(db, 'geminiKey', k);
      await savePref(db, 'geminiModel', model);
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

  const refresh = useCallback(async () => setStats(await counts(db)), [db]);
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
      <Header title="Réglages" />
      <ScrollView contentContainerStyle={st.content}>
        <Card style={st.card}>
          <Text style={st.title}>Mes données</Text>
          <Text style={st.text}>
            {plural(stats.trips, 'course', 'courses')}, {plural(stats.products, 'produit', 'produits')}, {plural(stats.items, 'prix noté', 'prix notés')}.
          </Text>
          <Text style={st.text}>Tout est enregistré sur ce téléphone. Seules les photos de tickets partent sur Internet, et seulement si la lecture Gemini est activée (plus bas).</Text>
        </Card>

        <Card style={st.card}>
          <Text style={st.title}>Ton prénom</Text>
          <Text style={st.text}>Pour te dire salam sur l'accueil. Il reste sur ce téléphone.</Text>
          <TextInput
            accessibilityLabel="Ton prénom"
            value={who}
            onChangeText={setWho}
            placeholder="Ex. Mohamed"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            maxLength={24}
            style={st.keyInput}
          />
          <Button
            label={who.trim() === whoSaved ? 'Prénom enregistré' : 'Enregistrer'}
            tone={who.trim() === whoSaved ? 'light' : 'primary'}
            disabled={busy}
            onPress={async () => {
              await savePref(db, 'name', who.trim());
              setWho(who.trim());
              setWhoSaved(who.trim());
            }}
          />
        </Card>

        <Card style={st.card}>
          <Text style={st.title}>Budget du mois</Text>
          <Text style={st.text}>L'accueil montre combien il te reste. Laisse vide pour ne pas suivre de budget.</Text>
          <View style={st.budgetRow}>
            <TextInput
              accessibilityLabel="Budget du mois en dirhams"
              value={budget}
              onChangeText={setBudget}
              placeholder="Ex. 2000"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={st.input}
            />
            <Text style={st.mad}>MAD</Text>
          </View>
          <Button label={budget.trim() === budgetSaved ? 'Budget enregistré' : 'Enregistrer le budget'} tone={budget.trim() === budgetSaved ? 'light' : 'primary'} onPress={saveBudget} disabled={busy} />
        </Card>

        <Card style={st.card}>
          <Text style={st.title}>Lecture précise des tickets (Gemini)</Text>
          <Text style={st.text}>
            Avec une clé Gemini, la photo du ticket est lue en ligne par Google : noms en arabe compris, photos penchées, tickets groupés par rayon. C'est gratuit et sans carte bancaire. Sans clé ou sans internet, le téléphone lit le ticket lui-même.
          </Text>
          <Text style={st.text}>
            Pour avoir ta clé : ouvre aistudio.google.com avec ton compte Google, touche « Get API key » puis « Create API key », copie la clé et colle-la ici. Avec la formule gratuite, Google peut utiliser les photos envoyées pour améliorer ses services.
          </Text>
          <TextInput
            accessibilityLabel="Clé Gemini"
            value={visionKey}
            onChangeText={(v) => {
              setVisionKey(v);
              setVisionMsg('');
            }}
            placeholder="Colle ta clé ici (AIza…)"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={visionSaved && !visionMsg}
            style={st.keyInput}
          />
          <Button label={visionKey.trim() ? 'Vérifier et enregistrer' : 'Retirer la clé'} tone={visionSaved && !visionMsg ? 'light' : 'primary'} onPress={saveVision} disabled={busy} />
          {visionMsg ? <Text style={st.text}>{visionMsg}</Text> : visionSaved ? <Text style={st.text}>La lecture Gemini est activée.</Text> : null}
        </Card>

        <Card style={st.card}>
          <Text style={st.title}>Apparence</Text>
          <View style={st.row}>
            <Pill label="Automatique" active={pref === 'system'} onPress={() => setPref('system')} />
            <Pill label="Clair" active={pref === 'light'} onPress={() => setPref('light')} />
            <Pill label="Sombre" active={pref === 'dark'} onPress={() => setPref('dark')} />
          </View>
          <Text style={st.text}>Automatique suit le réglage de ton téléphone.</Text>
        </Card>

        <Card style={st.card}>
          <Text style={st.title}>Sauvegarde</Text>
          <Text style={st.text}>
            Crée un fichier avec toutes tes courses. Envoie-le vers Google Drive, ton e-mail ou WhatsApp pour le garder en lieu sûr. Il s'ouvre aussi dans Excel.
          </Text>
          <Button label="Sauvegarder mes courses" icon="share-outline" onPress={doExport} disabled={busy} />
        </Card>

        <Card style={st.card}>
          <Text style={st.title}>Restaurer</Text>
          <Text style={st.text}>Recharge un fichier de sauvegarde, par exemple après un changement de téléphone. Les données actuelles sont remplacées.</Text>
          <Button label="Restaurer une sauvegarde" icon="download-outline" tone="light" onPress={doImport} disabled={busy} />
        </Card>

        <View style={st.about}>
          <Text style={st.aboutText}>bch7al? · version {Constants.expoConfig?.version ?? '2.0.0'}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const st = sheet(() => ({
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24, gap: 12 },
  card: { gap: 10, padding: 18 },
  title: { fontFamily: fonts.title, fontSize: 19, color: colors.ink },
  text: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, lineHeight: 21 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  keyInput: { minHeight: 50, borderRadius: 14, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 12, fontFamily: fonts.title, fontSize: 18, color: colors.ink, backgroundColor: colors.card },
  mad: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.muted },
  about: { alignItems: 'center', paddingTop: 8 },
  aboutText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
}));
