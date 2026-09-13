import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond';
import { Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { VT323_400Regular, useFonts } from '@expo-google-fonts/vt323';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { migrateDb } from '@/db/migrations';
import { AppLock } from '@/features/lock/app-lock';
import { ModulePreferencesProvider } from '@/features/modules/preferences';
import { XpProvider } from '@/features/progress/xp-provider';
import { ReminderSync } from '@/features/reminders/reminder-sync';
import { ThemePreferencesProvider } from '@/theme/preferences';
import { SAKURA_FONT, VAPOR_FONT, ZEN_FONT } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

export default function RootLayout() {
  // Kroje stylów vaporwave, zen i sakura (pliki są w pakiecie aplikacji, więc ładują się od razu, także w Expo Go).
  const [fontsLoaded, fontError] = useFonts({
    [VAPOR_FONT]: VT323_400Regular,
    [ZEN_FONT]: CormorantGaramond_600SemiBold,
    [SAKURA_FONT]: Quicksand_700Bold,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    // Preferencje wyglądu i układu modułów muszą być dostępne od pierwszej klatki.
    <ThemePreferencesProvider>
      <ModulePreferencesProvider>
        <App />
      </ModulePreferencesProvider>
    </ThemePreferencesProvider>
  );
}

function App() {
  const theme = useTheme();
  const base = theme.dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.accent,
      background: theme.colors.background,
      card: theme.colors.chrome,
      text: theme.colors.text,
      border: theme.colors.border,
    },
  };

  return (
    // Ekrany renderują się dopiero po migracji bazy.
    <SQLiteProvider databaseName="kaizen.db" onInit={migrateDb} options={{ enableChangeListener: true }}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        {/* Punkty (Postęp) są liczone raz dla całej aplikacji; „+XP” i gratulacje rysują się nad ekranami. */}
        <XpProvider>
          {/* Zakładki są pierwszym ekranem stosu; ekrany szczegółów (edycja itp.) będą otwierane nad nimi. */}
          <Stack
            screenOptions={{
              // Tytuły ekranów krojem stylu (vaporwave, zen); w stylu klasycznym systemowe.
              headerTitleStyle: theme.display ? { fontFamily: theme.display.family, fontSize: theme.display.headerSize } : undefined,
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </XpProvider>
        <ReminderSync />
        <AppLock />
      </ThemeProvider>
    </SQLiteProvider>
  );
}
