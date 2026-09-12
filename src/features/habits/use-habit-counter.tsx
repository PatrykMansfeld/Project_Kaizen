import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { nextHabitCount, setHabitCount, type Habit } from '@/db/habits';
import type { DateKey } from '@/lib/dates';

import { isAmountHabit } from './amount';
import { AmountSheet, type AmountTarget } from './amount-sheet';

/**
 * Odhaczanie nawyku w danym dniu. Licznik: stuknięcie +1 (po celu — zero), przytrzymanie −1.
 * Nawyk ilościowy: oba gesty otwierają okienko z ilością — `sheet` trzeba wyrenderować na ekranie.
 */
export function useHabitCounter(today: DateKey) {
  const db = useSQLiteContext();
  const [amountTarget, setAmountTarget] = useState<AmountTarget | null>(null);

  const tap = (habit: Habit, date: DateKey, count: number) =>
    isAmountHabit(habit)
      ? setAmountTarget({ habit, date, count })
      : void setHabitCount(db, habit.id, date, nextHabitCount(count, habit.target_per_day));

  const hold = (habit: Habit, date: DateKey, count: number) => {
    if (isAmountHabit(habit)) setAmountTarget({ habit, date, count });
    else if (count > 0) void setHabitCount(db, habit.id, date, count - 1);
  };

  const sheet = (
    <AmountSheet
      target={amountTarget}
      today={today}
      onSave={({ habit, date }, count) => setHabitCount(db, habit.id, date, count)}
      onClose={() => setAmountTarget(null)}
    />
  );

  return { tap, hold, sheet };
}
