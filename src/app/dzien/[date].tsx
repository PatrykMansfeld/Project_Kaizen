import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayNavigator } from '@/components/day-navigator';
import { DayAgenda } from '@/features/day/day-agenda';
import { isDateKey, type DateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Pełny widok dnia: /dzien/2026-09-10. Strzałki przełączają dni. */
export default function DayScreen() {
  const params = useLocalSearchParams<{ date: string }>();
  const today = useToday();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState<DateKey>(isDateKey(params.date) ? params.date : today);

  return (
    <>
      <Stack.Screen options={{ title: 'Dzień' }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <DayNavigator date={date} today={today} onChange={setDate} />
        <DayAgenda date={date} today={today} variant="full" />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, padding: spacing.lg },
});
