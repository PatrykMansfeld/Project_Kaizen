import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Chip, ChipRow } from '@/components/chip';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import { deleteSetting, setSetting } from '@/db/settings';
import { useSetting } from '@/db/use-query';
import { WEEKDAYS_SHORT } from '@/lib/dates';
import { spacing } from '@/theme/theme';

import { EXPO_GO_NOTICE, notificationsSupported, requestPermission } from './reminders';

/** Ustawienie wieczornego przypomnienia „Podsumuj dzień”. */
export function ReviewSettings() {
  const db = useSQLiteContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const time = useSetting('review_time');

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
      <ChipRow>
        <Chip label="Bez przypomnienia" selected={time === null} onPress={() => deleteSetting(db, 'review_time')} />
        <Chip
          label={time ? `Codziennie o ${time}` : 'Ustaw godzinę'}
          icon="bedtime"
          selected={time !== null}
          onPress={() => setPickerOpen(true)}
        />
      </ChipRow>
      {time ? <ExpoGoNotice /> : null}
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

/** Przypomnienie o przeglądzie tygodnia: dzień tygodnia i godzina (zapis 'D HH:MM', D: 0 = pn … 6 = nd). */
export function WeeklyReviewSettings() {
  const db = useSQLiteContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const match = useSetting('weekly_review_time')?.match(/^([0-6]) (\d{2}:\d{2})$/);
  const weekday = match ? Number(match[1]) : null;
  const time = match ? match[2] : null;

  const save = async (day: number, at: string) => {
    await setSetting(db, 'weekly_review_time', `${day} ${at}`);
    await requestPermission();
  };

  return (
    <View style={styles.container}>
      <AppText tone="textSecondary">
        Raz w tygodniu: co poszło dobrze, co poprawić i 3 priorytety na kolejny tydzień. Ekran otworzysz też z zakładki
        Dziś.
      </AppText>
      <ChipRow>
        <Chip label="Bez przypomnienia" selected={weekday === null} onPress={() => deleteSetting(db, 'weekly_review_time')} />
        {WEEKDAYS_SHORT.map((name, index) => (
          <Chip key={name} label={name} selected={weekday === index} onPress={() => save(index, time ?? '19:00')} />
        ))}
      </ChipRow>
      {weekday !== null ? (
        <>
          <ChipRow>
            <Chip label={`Godzina ${time}`} icon="schedule" selected onPress={() => setPickerOpen(true)} />
          </ChipRow>
          <ExpoGoNotice />
        </>
      ) : null}
      <TimePickerSheet
        visible={pickerOpen}
        title="Przegląd tygodnia"
        value={time ?? '19:00'}
        onChange={(value) => save(weekday ?? 6, value)}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

function ExpoGoNotice() {
  if (notificationsSupported) return null;
  return (
    <AppText variant="caption" tone="textMuted">
      {EXPO_GO_NOTICE}
    </AppText>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
});
