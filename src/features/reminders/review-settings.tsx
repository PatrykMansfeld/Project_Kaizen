import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import { SETTING_SQL, deleteSetting, setSetting } from '@/db/settings';
import { useQuery } from '@/db/use-query';
import { spacing } from '@/theme/theme';

import { notificationsSupported, requestPermission } from './reminders';

/** Ustawienie wieczornego przypomnienia „Podsumuj dzień”. */
export function ReviewSettings() {
  const db = useSQLiteContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { rows } = useQuery<{ value: string }>(SETTING_SQL, { $key: 'review_time' }, ['settings']);
  const time = rows[0]?.value ?? null;

  const setTime = async (value: string) => {
    await setSetting(db, 'review_time', value);
    await requestPermission();
  };

  return (
    <View style={styles.container}>
      <AppText tone="textSecondary">
        Wieczorem minuta na domknięcie dnia: nawyki, zadania, nastrój i plan na jutro. Ekran otworzysz też z zakładki
        Dziś.
      </AppText>
      <View style={styles.row}>
        <Chip label="Bez przypomnienia" selected={time === null} onPress={() => deleteSetting(db, 'review_time')} />
        <Chip
          label={time ? `Codziennie o ${time}` : 'Ustaw godzinę'}
          icon="bedtime"
          selected={time !== null}
          onPress={() => setPickerOpen(true)}
        />
      </View>
      {time && !notificationsSupported ? (
        <AppText variant="caption" tone="textMuted">
          W Expo Go powiadomienia nie działają — przypomnienie zacznie przychodzić po zainstalowaniu aplikacji (APK).
        </AppText>
      ) : null}
      <TimePickerSheet
        visible={pickerOpen}
        title="Podsumowanie dnia"
        value={time ?? '21:00'}
        onChange={setTime}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
