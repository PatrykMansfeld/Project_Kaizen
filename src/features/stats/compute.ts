import type { Habit } from '@/db/habits';
import { bestStreak, currentStreak, habitStartDay, isScheduled } from '@/features/habits/streak';
import { addDays, fromDateKey, startOfWeek, toDateKey, type DateKey } from '@/lib/dates';

export type Period = 'week' | 'month';

export type PeriodRange = {
  from: DateKey;
  to: DateKey;
  /** Poprzedni okres tej samej długości — do porównań. */
  prevFrom: DateKey;
  prevTo: DateKey;
  /** Kolejne dni okresu. */
  days: DateKey[];
};

/** Tydzień (pn–nd) albo miesiąc kalendarzowy zawierający `anchor`, plus okres poprzedni. */
export function periodRange(period: Period, anchor: DateKey): PeriodRange {
  let from: DateKey;
  let to: DateKey;
  let prevFrom: DateKey;
  if (period === 'week') {
    from = startOfWeek(anchor);
    to = addDays(from, 6);
    prevFrom = addDays(from, -7);
  } else {
    const date = fromDateKey(anchor);
    from = toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
    to = toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
    prevFrom = toDateKey(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  }
  const days: DateKey[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return { from, to, prevFrom, prevTo: addDays(from, -1), days };
}

/** Przesuwa okres o `delta` tygodni/miesięcy (zwraca nowy „punkt zaczepienia”). */
export function shiftPeriod(period: Period, anchor: DateKey, delta: number): DateKey {
  if (period === 'week') return addDays(anchor, 7 * delta);
  const date = fromDateKey(anchor);
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + delta, 1));
}

export type HabitMonthStats = {
  /** Dni w harmonogramie, które już minęły (dziś — tylko jeśli wykonane). */
  scheduled: number;
  done: number;
  /** 0–1 albo null, gdy w tym miesiącu nie było jeszcze żadnego dnia do zrobienia. */
  rate: number | null;
  best: number;
  current: number;
};

/**
 * Skuteczność nawyku w miesiącu: wykonane dni z harmonogramu / dni z harmonogramu.
 * Liczymy od początku nawyku; dzisiejszy dzień wlicza się dopiero po wykonaniu, żeby
 * skuteczność nie spadała rano tylko dlatego, że dzień jeszcze trwa.
 */
export function habitMonthStats(
  habit: Pick<Habit, 'created_at' | 'days_mask' | 'target_per_day'>,
  counts: Map<DateKey, number>,
  doneDays: Set<DateKey>,
  monthStart: DateKey,
  monthEnd: DateKey,
  today: DateKey,
): HabitMonthStats {
  const start = habitStartDay(habit.created_at, doneDays);
  const from = start > monthStart ? start : monthStart;
  const to = monthEnd < today ? monthEnd : today;

  let scheduled = 0;
  let done = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const complete = (counts.get(day) ?? 0) >= habit.target_per_day;
    if (!isScheduled(habit.days_mask, day)) continue;
    if (day === today && !complete) continue;
    scheduled++;
    if (complete) done++;
  }

  return {
    scheduled,
    done,
    rate: scheduled > 0 ? done / scheduled : null,
    best: bestStreak(doneDays, today, habit.days_mask, start),
    current: currentStreak(doneDays, today, habit.days_mask, start),
  };
}

export function moodStats(moods: number[]) {
  const counts = [1, 2, 3, 4, 5].map((value) => moods.filter((mood) => mood === value).length);
  const average = moods.length ? moods.reduce((sum, mood) => sum + mood, 0) / moods.length : null;
  return { counts, average };
}

export type WeekBucket = { start: DateKey; minutes: number; count: number };

/** Minuty i liczba treningów w kolejnych tygodniach (od poniedziałku `weeks[i]`). */
export function weeklyActivity(
  workouts: { date: DateKey; duration_min: number | null }[],
  weekStarts: DateKey[],
): WeekBucket[] {
  return weekStarts.map((start) => {
    const end = addDays(start, 6);
    const inWeek = workouts.filter((workout) => workout.date >= start && workout.date <= end);
    return {
      start,
      minutes: inWeek.reduce((sum, workout) => sum + (workout.duration_min ?? 0), 0),
      count: inWeek.length,
    };
  });
}
