import type { IconName } from '@/components/icon';
import { PRIORITY_LABELS, type Priority, type Task } from '@/db/tasks';
import { addDays, formatDayRelative, type DateKey } from '@/lib/dates';
import type { ThemeColors } from '@/theme/theme';

/**
 * Macierz Eisenhowera liczona z tego, co zadanie już ma: ważne = priorytet średni lub wysoki,
 * pilne = termin najpóźniej pojutrze (także zaległe). Nic nie trzeba dopisywać do zadań.
 */

export type Quadrant = 'do' | 'plan' | 'quick' | 'later';

/** Ile dni do przodu termin jest jeszcze „pilny”. */
export const URGENT_DAYS = 2;

/** Od tego priorytetu zadanie jest „ważne”. */
export const IMPORTANT_FROM: Priority = 2;

type QuadrantInfo = {
  title: string;
  /** Krótko, na kafelku. */
  action: string;
  /** Wskazówka pod nagłówkiem ćwiartki. */
  hint: string;
  color: keyof ThemeColors;
  icon: IconName;
};

export const QUADRANTS: Record<Quadrant, QuadrantInfo> = {
  do: { title: 'Pilne i ważne', action: 'Zrób teraz', hint: 'Zrób dziś — to nie może czekać.', color: 'danger', icon: 'priority_high' },
  plan: {
    title: 'Ważne, niepilne',
    action: 'Zaplanuj',
    hint: 'Wybierz konkretny dzień — tu dzieje się rozwój.',
    color: 'tasks',
    icon: 'event',
  },
  quick: { title: 'Pilne, mniej ważne', action: 'Załatw szybko', hint: 'Załatw szybko albo przekaż komuś.', color: 'warning', icon: 'bolt' },
  later: { title: 'Ani pilne, ani ważne', action: 'Później', hint: 'Zrób, gdy będzie czas — albo odpuść.', color: 'textMuted', icon: 'low_priority' },
};

export const QUADRANT_KEYS: Quadrant[] = ['do', 'plan', 'quick', 'later'];

type Classified = Pick<Task, 'priority' | 'due_date'>;

export function isImportant(task: Pick<Task, 'priority'>) {
  return task.priority >= IMPORTANT_FROM;
}

export function isUrgent(task: Pick<Task, 'due_date'>, today: DateKey) {
  return task.due_date !== null && task.due_date <= addDays(today, URGENT_DAYS);
}

export function quadrantOf(task: Classified, today: DateKey): Quadrant {
  const important = isImportant(task);
  if (isUrgent(task, today)) return important ? 'do' : 'quick';
  return important ? 'plan' : 'later';
}

/** Otwarte zadania rozdzielone na ćwiartki (kolejność z zapytania zostaje). */
export function splitByQuadrant<T extends Classified>(tasks: readonly T[], today: DateKey): Record<Quadrant, T[]> {
  const result: Record<Quadrant, T[]> = { do: [], plan: [], quick: [], later: [] };
  for (const task of tasks) result[quadrantOf(task, today)].push(task);
  return result;
}

export type QuadrantMove = { priority: Priority; due_date: DateKey | null; changes: string[] };

/**
 * Co zmienić, żeby zadanie trafiło do ćwiartki — tylko to, co konieczne:
 * ważne dostaje priorytet średni, mniej ważne niski; pilne termin dziś, niepilne za tydzień („Zaplanuj”)
 * albo bez terminu („Później”).
 */
export function moveToQuadrant(task: Classified, quadrant: Quadrant, today: DateKey): QuadrantMove {
  const wantImportant = quadrant === 'do' || quadrant === 'plan';
  const wantUrgent = quadrant === 'do' || quadrant === 'quick';
  let priority = task.priority;
  let dueDate = task.due_date;
  const changes: string[] = [];

  if (wantImportant !== isImportant(task)) {
    priority = wantImportant ? IMPORTANT_FROM : task.priority > 0 ? 1 : 0;
    changes.push(`priorytet: ${PRIORITY_LABELS[priority].toLowerCase()}`);
  }
  if (wantUrgent !== isUrgent(task, today)) {
    dueDate = wantUrgent ? today : quadrant === 'plan' ? addDays(today, 7) : null;
    changes.push(dueDate ? `termin: ${formatDayRelative(dueDate, today).toLowerCase()}` : 'bez terminu');
  }
  return { priority, due_date: dueDate, changes };
}
