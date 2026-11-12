import { Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { SQLiteProvider } from '@/sqlite';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onOpen } from '@/db';
import { colors } from '@/theme';

export default function RootLayout() {
  const [loaded, error] = useFonts({ Fredoka_600SemiBold, Fredoka_700Bold, Nunito_700Bold, Nunito_800ExtraBold });
  // If a font fails to load the app still opens with the system font.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="bch7al.db" onInit={onOpen}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="trips" options={{ animation: 'none' }} />
          <Stack.Screen name="products" options={{ animation: 'none' }} />
          <Stack.Screen name="settings" options={{ animation: 'none' }} />
        </Stack>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
