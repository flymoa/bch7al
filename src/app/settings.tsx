import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from '@/sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/alert';
import { Button, Card, Header, Pill, Screen } from '@/components/ui';
import { counts, exportCsv, importCsv } from '@/db';
import { plural, todayIso } from '@/format';
import { colors, fonts, sheet, useTheme } from '@/theme';

export default function Settings() {
  const { pref, setPref } = useTheme();
  const db = useSQLiteContext();
  const [stats, setStats] = useState({ trips: 0, products: 0, items: 0 });
  const [busy, setBusy] = useState(false);

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
    <Screen bottomBar="settings">
      <Header title="Réglages" back={false} />
      <ScrollView contentContainerStyle={st.content}>
        <Card style={st.card}>
          <Text style={st.title}>Mes données</Text>
          <Text style={st.text}>
            {plural(stats.trips, 'course', 'courses')}, {plural(stats.products, 'produit', 'produits')}, {plural(stats.items, 'prix noté', 'prix notés')}.
          </Text>
          <Text style={st.text}>Tout est enregistré sur ce téléphone. Rien n'est envoyé sur Internet.</Text>
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
          <Text style={st.aboutText}>bch7al? · version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
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
  about: { alignItems: 'center', paddingTop: 8 },
  aboutText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
}));
