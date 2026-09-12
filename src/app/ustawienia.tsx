import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, type ReactNode } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { BackupError, backupSummary, restoreBackup } from '@/db/backup';
import { useSetting } from '@/db/use-query';
import { AppearanceSettings } from '@/features/appearance/appearance-settings';
import { exportBackup, pickBackup } from '@/features/backup/backup-file';
import { LockSettings } from '@/features/lock/lock-settings';
import { ReminderSettings } from '@/features/reminders/reminder-settings';
import { ReviewSettings, WeeklyReviewSettings } from '@/features/reminders/review-settings';
import { TagManager } from '@/features/tags/tags';
import { diffDays, formatDayShort, formatTimestamp, toDateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';

function errorMessage(error: unknown) {
  return error instanceof BackupError ? error.message : 'Coś poszło nie tak. Spróbuj ponownie.';
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const [busy, setBusy] = useState(false);

  const lastExport = useSetting('last_export_at');
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
    <ScrollScreen title="Ustawienia">
      <SettingsSection title="Kopia zapasowa">
        <AppText tone="textSecondary">
          Dane są zapisane tylko w tym telefonie. Eksportuj je co jakiś czas do pliku, np. na Dysk Google, żeby
          nie stracić ich przy zmianie lub utracie telefonu. Zdjęcia z notatek nie trafiają do kopii.
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
      </SettingsSection>

      <SettingsSection title="Wygląd">
        <AppearanceSettings />
      </SettingsSection>

      <SettingsSection title="Blokada aplikacji">
        <LockSettings />
      </SettingsSection>

      <SettingsSection title="Podsumowanie dnia">
        <ReviewSettings />
      </SettingsSection>

      <SettingsSection title="Przegląd tygodnia">
        <WeeklyReviewSettings />
      </SettingsSection>

      <SettingsSection title="Przypomnienia">
        <ReminderSettings />
      </SettingsSection>

      <SettingsSection title="Tagi">
        <TagManager />
      </SettingsSection>

      <AppText variant="caption" tone="textMuted" style={styles.version}>
        Kaizen {Constants.expoConfig?.version ?? ''}
      </AppText>
    </ScrollScreen>
  );
}

/** Sekcja ustawień: podpis i treść na karcie. */
function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section title={title}>
      <Card>{children}</Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  version: { textAlign: 'center' },
});
