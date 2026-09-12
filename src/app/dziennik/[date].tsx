import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayNavigator } from '@/components/day-navigator';
import { StackHeader } from '@/components/screen';
import { JournalEditor } from '@/features/journal/journal-editor';
import { isDateKey, type DateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Dziennik: /dziennik/2026-09-10. Strzałki przełączają dni, wpis zapisuje się sam. */
export default function JournalScreen() {
  const params = useLocalSearchParams<{ date: string }>();
  const today = useToday();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState<DateKey>(isDateKey(params.date) ? params.date : today);

  return (
    <>
      <StackHeader title="Dziennik" />
      <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
        <DayNavigator date={date} today={today} onChange={setDate} maxDate={today} />
        {/* key: zmiana dnia montuje edytor od nowa, a odmontowanie zapisuje poprzedni dzień. */}
        <JournalEditor key={date} date={date} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
});
