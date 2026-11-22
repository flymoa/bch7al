import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular';
import { IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import { IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold';
import { IBMPlexSansArabic_700Bold } from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold';
import { Kufam_600SemiBold } from '@expo-google-fonts/kufam/600SemiBold';
import { Kufam_700Bold } from '@expo-google-fonts/kufam/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Intro } from '@/components/intro';
import { ToastHost } from '@/components/toast';
import { getPref, onOpen, setPref as savePref, type Db } from '@/db';
import { SQLiteProvider } from '@/sqlite';
import { applyScheme, colors, ThemeContext, type Scheme, type ThemePref } from '@/theme';
import { brand } from '@/tokens';

// Keep the phone's launch screen (plain night ink) up until our intro takes over.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Kufam_600SemiBold, Kufam_700Bold,
    IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold,
  });
  const fontsReady = fontsLoaded || !!fontError; // if a font fails, the app still opens with the system font
  const [dbReady, setDbReady] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [pref, setPrefState] = useState<ThemePref>('system');
  const dbRef = useRef<Db | null>(null);

  const system = useColorScheme();
  const scheme: Scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  applyScheme(scheme); // swap the palette before anything below renders

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  const init = useCallback(async (db: Db) => {
    await onOpen(db);
    dbRef.current = db;
    const saved = await getPref(db, 'theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') setPrefState(saved);
    setDbReady(true);
  }, []);
  const finish = useCallback(() => setIntroDone(true), []);

  const theme = useMemo(
    () => ({
      scheme,
      pref,
      setPref: (p: ThemePref) => {
        setPrefState(p);
        if (dbRef.current) savePref(dbRef.current, 'theme', p).catch(() => {});
      },
    }),
    [scheme, pref],
  );

  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: brand.night }} />;

  const tab = { animation: 'none' as const };
  return (
    <ThemeContext.Provider value={theme}>
      <SafeAreaProvider>
        <StatusBar style={!introDone || scheme === 'dark' ? 'light' : 'dark'} />
        <SQLiteProvider databaseName="bch7al.db" onInit={init}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" options={tab} />
            <Stack.Screen name="products" options={tab} />
            <Stack.Screen name="list" options={tab} />
            <Stack.Screen name="month" options={tab} />
            <Stack.Screen name="camera" options={{ animation: 'fade' }} />
          </Stack>
          <ToastHost />
        </SQLiteProvider>
        {introDone ? null : <Intro ready={dbReady} onDone={finish} />}
      </SafeAreaProvider>
    </ThemeContext.Provider>
  );
}
