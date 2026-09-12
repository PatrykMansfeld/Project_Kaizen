import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { DayNavigator } from '@/components/day-navigator';
import { ScrollScreen } from '@/components/screen';
import { DayAgenda } from '@/features/day/day-agenda';
import { isDateKey, type DateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';

/** Pełny widok dnia: /dzien/2026-09-10. Strzałki przełączają dni. */
export default function DayScreen() {
  const params = useLocalSearchParams<{ date: string }>();
  const today = useToday();
  const [date, setDate] = useState<DateKey>(isDateKey(params.date) ? params.date : today);

  return (
    <ScrollScreen title="Dzień">
      <DayNavigator date={date} today={today} onChange={setDate} />
      <DayAgenda date={date} today={today} variant="full" />
    </ScrollScreen>
  );
}
