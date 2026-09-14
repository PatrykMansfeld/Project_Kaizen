import { isScheduled } from '@/features/habits/streak';
import { MOODS } from '@/features/journal/moods';
import { MONTHS, type DateKey } from '@/lib/dates';
import { FORMS, formatDuration, plural } from '@/lib/format';

/** Co pokazuje siatka roku. */
export type PixelMetric = 'mood' | 'sleep' | 'workouts' | `habit:${number}`;

export type PixelHabit = { id: number; days_mask: number; target_per_day: number; unit: string | null };

/** Dane roku potrzebne do pokolorowania dni. */
export type PixelData = {
  moods: Map<DateKey, number>;
  sleep: Map<DateKey, number>;
  /** Minuty treningów w dniu (trening bez czasu liczy się jako 0 min, ale dzień i tak jest aktywny). */
  workouts: Map<DateKey, { count: number; minutes: number }>;
  habit: PixelHabit | null;
  habitCounts: Map<DateKey, number>;
};

/**
 * Poziom dnia: 0 = brak danych / nic, 1…`levels` = rosnąca intensywność (skala sekwencyjna jednego koloru).
 * null = dzień nie wchodzi w grę (nawyk w ten dzień nie obowiązywał i nie był zrobiony).
 */
export function pixelLevel(metric: PixelMetric, day: DateKey, data: PixelData): number | null {
  if (metric === 'mood') return data.moods.get(day) ?? 0;
  if (metric === 'sleep') {
    const minutes = data.sleep.get(day);
    if (minutes === undefined) return 0;
    return minutes < 6 * 60 ? 1 : minutes < 7 * 60 ? 2 : minutes < 8 * 60 ? 3 : 4;
  }
  if (metric === 'workouts') {
    const entry = data.workouts.get(day);
    if (!entry) return 0;
    return entry.minutes < 30 ? 1 : entry.minutes < 60 ? 2 : entry.minutes < 90 ? 3 : 4;
  }
  const habit = data.habit;
  if (!habit) return 0;
  const count = data.habitCounts.get(day) ?? 0;
  if (count === 0) return isScheduled(habit.days_mask, day) ? 0 : null;
  if (count >= habit.target_per_day) return 4;
  return Math.min(Math.max(Math.ceil((count / habit.target_per_day) * 3), 1), 3);
}

/** Liczba poziomów skali (bez zera). */
export function metricLevels(metric: PixelMetric) {
  return metric === 'mood' ? 5 : 4;
}

/** Podpisy legendy dla poziomów 1…n. */
export function legendLabels(metric: PixelMetric, habit: PixelHabit | null): string[] {
  if (metric === 'mood') return MOODS.map((mood) => mood.emoji);
  if (metric === 'sleep') return ['< 6 h', '6–7 h', '7–8 h', '8+ h'];
  if (metric === 'workouts') return ['< 30 min', '30–59', '60–89', '90+'];
  return habit && habit.target_per_day > 1 ? ['', 'Częściowo', '', 'Zrobione'] : ['', '', '', 'Zrobione'];
}

/** Odczyt po stuknięciu w dzień. */
export function pixelReadout(metric: PixelMetric, day: DateKey, data: PixelData): string {
  if (metric === 'mood') {
    const mood = MOODS.find((item) => item.value === data.moods.get(day));
    return mood ? `${mood.emoji} ${mood.label}` : 'Brak oceny nastroju';
  }
  if (metric === 'sleep') {
    const minutes = data.sleep.get(day);
    return minutes === undefined ? 'Brak zapisu snu' : `Sen ${formatDuration(minutes)}`;
  }
  if (metric === 'workouts') {
    const entry = data.workouts.get(day);
    if (!entry) return 'Bez treningu';
    const count = plural(entry.count, FORMS.workout);
    return entry.minutes ? `${count} · ${formatDuration(entry.minutes)}` : count;
  }
  const habit = data.habit;
  if (!habit) return '';
  const count = data.habitCounts.get(day) ?? 0;
  if (count === 0) return isScheduled(habit.days_mask, day) ? 'Niezrobione' : 'Nie w planie';
  if (habit.unit) return `${count} / ${habit.target_per_day} ${habit.unit}`;
  if (habit.target_per_day > 1) return `${count} / ${habit.target_per_day}`;
  return 'Zrobione';
}

/** Krótkie nazwy miesięcy do nagłówka siatki: sty, lut, mar… */
export const MONTHS_SHORT = MONTHS.map((month) => month.slice(0, 3));

/** Dzień roku jako klucz albo null, gdy taki dzień nie istnieje (np. 30 lutego). */
export function yearDay(year: number, month: number, day: number): DateKey | null {
  if (day > new Date(year, month + 1, 0).getDate()) return null;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
