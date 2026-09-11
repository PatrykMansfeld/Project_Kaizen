import type { Habit } from '@/db/habits';

/** Nawyk „ilościowy” (np. 10 000 kroków) — stuknięcie otwiera okienko z ilością zamiast +1. */
export function isAmountHabit(habit: Pick<Habit, 'unit'>) {
  return habit.unit !== null;
}

/** 10000 → „10 000” (spacja nierozdzielająca jak w polskiej typografii). */
export function formatAmount(value: number) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** „3/5” dla licznika, „2 500 / 10 000 kroków” dla ilości. */
export function progressLabel(count: number, habit: Pick<Habit, 'unit' | 'target_per_day'>) {
  return habit.unit
    ? `${formatAmount(count)} / ${formatAmount(habit.target_per_day)} ${habit.unit}`
    : `${count}/${habit.target_per_day}`;
}

/** Krótki podpis na okrągłym przycisku: licznik „2/3”, ilość w procentach. */
export function buttonLabel(count: number, habit: Pick<Habit, 'unit' | 'target_per_day'>) {
  return habit.unit ? `${Math.floor((count / habit.target_per_day) * 100)}%` : `${count}/${habit.target_per_day}`;
}

/** Szybkie przyciski „+” dopasowane do wielkości celu. */
export function quickSteps(target: number) {
  if (target <= 20) return [1, 2, 5];
  if (target <= 200) return [5, 10, 30];
  if (target <= 2000) return [50, 100, 250];
  return [500, 1000, 2500];
}

export const UNIT_SUGGESTIONS = ['szklanek', 'kroków', 'min', 'stron', 'km', 'powtórzeń'];
