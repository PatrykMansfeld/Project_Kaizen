import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { migrateDb } from '@/db/migrations';
import { AppLock } from '@/features/lock/app-lock';
import { ModulePreferencesProvider } from '@/features/modules/preferences';
import { ReminderSync } from '@/features/reminders/reminder-sync';
import { ThemePreferencesProvider } from '@/theme/preferences';
import { useTheme } from '@/theme/use-theme';

export default function RootLayout() {
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
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
    },
  };

  return (
    // Ekrany renderują się dopiero po migracji bazy.
    <SQLiteProvider databaseName="kaizen.db" onInit={migrateDb} options={{ enableChangeListener: true }}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        {/* Zakładki są pierwszym ekranem stosu; ekrany szczegółów (edycja itp.) będą otwierane nad nimi. */}
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <ReminderSync />
        <AppLock />
      </ThemeProvider>
    </SQLiteProvider>
  );
}
