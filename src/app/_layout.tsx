import { Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Intro } from '@/components/intro';
import { ToastHost } from '@/components/toast';
import { onOpen, type Db } from '@/db';
import { SQLiteProvider } from '@/sqlite';
import { colors } from '@/theme';

// Keep the phone's launch screen up until our own intro is ready to take over.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Fredoka_600SemiBold, Fredoka_700Bold, Nunito_700Bold, Nunito_800ExtraBold });
  const fontsReady = fontsLoaded || !!fontError; // if a font fails, the app still opens with the system font
  const [dbReady, setDbReady] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  const init = useCallback(async (db: Db) => {
    await onOpen(db);
    setDbReady(true);
  }, []);
  const finish = useCallback(() => setIntroDone(true), []);

  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: colors.blue }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style={introDone ? 'dark' : 'light'} />
      <SQLiteProvider databaseName="bch7al.db" onInit={init}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="trips" options={{ animation: 'none' }} />
          <Stack.Screen name="products" options={{ animation: 'none' }} />
          <Stack.Screen name="settings" options={{ animation: 'none' }} />
        </Stack>
        <ToastHost />
      </SQLiteProvider>
      {introDone ? null : <Intro ready={dbReady} onDone={finish} />}
    </SafeAreaProvider>
  );
}
