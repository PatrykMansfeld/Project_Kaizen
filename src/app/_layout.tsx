import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { migrateDb } from '@/db/migrations';
import { ReminderSync } from '@/features/habits/reminder-sync';
import { useTheme } from '@/theme/use-theme';

export default function RootLayout() {
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
        <StatusBar style="auto" />
        {/* Zakładki są pierwszym ekranem stosu; ekrany szczegółów (edycja itp.) będą otwierane nad nimi. */}
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <ReminderSync />
      </ThemeProvider>
    </SQLiteProvider>
  );
}
