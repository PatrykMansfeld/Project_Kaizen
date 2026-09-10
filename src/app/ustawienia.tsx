import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { BackupError, backupSummary, restoreBackup } from '@/db/backup';
import { SETTING_SQL } from '@/db/settings';
import { useQuery } from '@/db/use-query';
import { exportBackup, pickBackup } from '@/features/backup/backup-file';
import { ReminderSettings } from '@/features/habits/reminder-settings';
import { diffDays, formatDayShort, formatTimestamp, toDateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

function errorMessage(error: unknown) {
  return error instanceof BackupError ? error.message : 'Coś poszło nie tak. Spróbuj ponownie.';
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const { rows } = useQuery<{ value: string }>(SETTING_SQL, { $key: 'last_export_at' }, ['settings']);
  const lastExport = rows[0]?.value ?? null;
  const daysSinceExport = lastExport ? diffDays(toDateKey(new Date(lastExport)), today) : null;

  const runExport = async () => {
    setBusy(true);
    try {
      await exportBackup(db);
    } catch (error) {
      console.error('Eksport:', error);
      Alert.alert('Nie udało się wyeksportować', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    try {
      const backup = await pickBackup();
      if (!backup) return;
      const date = backup.exportedAt ? formatDayShort(toDateKey(new Date(backup.exportedAt)), today) : 'nieznana data';
      Alert.alert(
        'Przywrócić kopię?',
        `Kopia z: ${date}\n${backupSummary(backup)}\n\nObecne dane w aplikacji zostaną zastąpione danymi z kopii.`,
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Przywróć',
            style: 'destructive',
            onPress: async () => {
              try {
                await restoreBackup(db, backup);
                Alert.alert('Gotowe', 'Dane zostały przywrócone z kopii.');
              } catch (error) {
                console.error('Import:', error);
                Alert.alert('Nie udało się przywrócić', `${errorMessage(error)}\nTwoje dane nie zostały zmienione.`);
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error('Import:', error);
      Alert.alert('Nie udało się wczytać pliku', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Ustawienia' }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Section title="Kopia zapasowa">
          <AppText tone="textSecondary">
            Dane są zapisane tylko w tym telefonie. Eksportuj je co jakiś czas do pliku, np. na Dysk Google, żeby
            nie stracić ich przy zmianie lub utracie telefonu.
          </AppText>
          <AppText
            variant="caption"
            tone={daysSinceExport === null || daysSinceExport > 7 ? 'warning' : 'textSecondary'}>
            {lastExport
              ? `Ostatni eksport: ${formatTimestamp(lastExport, today).toLowerCase()}`
              : 'Nie zrobiono jeszcze żadnej kopii.'}
          </AppText>
          <Button label="Eksportuj dane" icon="upload" onPress={runExport} disabled={busy} />
          <Button label="Przywróć z pliku" icon="download" variant="secondary" onPress={runImport} disabled={busy} />
        </Section>

        <Section title="Przypomnienia">
          <ReminderSettings />
        </Section>

        <AppText variant="caption" tone="textMuted" style={styles.version}>
          Kaizen {Constants.expoConfig?.version ?? ''}
        </AppText>
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <AppText variant="label" tone="textSecondary">
        {title}
      </AppText>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, padding: spacing.lg },
  section: { gap: spacing.sm },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.md },
  version: { textAlign: 'center' },
});
