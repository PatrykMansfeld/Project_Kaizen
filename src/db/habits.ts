import type { SQLiteDatabase } from 'expo-sqlite';

import type { DateKey } from '@/lib/dates';

export type Habit = {
  id: number;
  name: string;
  /** Emoji. */
  icon: string;
  /** Klucz z palety features/habits/palette.ts. */
  color: string;
  target_per_day: number;
  /** 'HH:MM' albo null (bez przypomnienia). */
  reminder_time: string | null;
  sort_order: number;
  archived: 0 | 1;
  created_at: string;
};

export type HabitInput = Pick<Habit, 'name' | 'icon' | 'color' | 'target_per_day' | 'reminder_time'>;

export type HabitLog = { habit_id: number; date: DateKey; count: number };

export const HABITS_SQL = 'SELECT * FROM habits WHERE archived = 0 ORDER BY sort_order, id';

export const HABIT_LOGS_RANGE_SQL =
  'SELECT habit_id, date, count FROM habit_logs WHERE date BETWEEN $from AND $to';

/** Dni, w których cel został osiągnięty — do liczenia serii. */
export const HABIT_DONE_DAYS_SQL = `
  SELECT l.habit_id, l.date
  FROM habit_logs l JOIN habits h ON h.id = l.habit_id
  WHERE h.archived = 0 AND l.count >= h.target_per_day`;

export function getHabit(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ?', id);
}

function toParams(input: HabitInput) {
  return {
    $name: input.name,
    $icon: input.icon,
    $color: input.color,
    $target: input.target_per_day,
    $reminder: input.reminder_time,
  };
}

export function createHabit(db: SQLiteDatabase, input: HabitInput) {
  return db.runAsync(
    `INSERT INTO habits (name, icon, color, target_per_day, reminder_time, sort_order)
     VALUES ($name, $icon, $color, $target, $reminder, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM habits))`,
    toParams(input),
  );
}

export function updateHabit(db: SQLiteDatabase, id: number, input: HabitInput) {
  return db.runAsync(
    `UPDATE habits SET name = $name, icon = $icon, color = $color, target_per_day = $target,
       reminder_time = $reminder
     WHERE id = $id`,
    { ...toParams(input), $id: id },
  );
}

/** Usuwa nawyk razem z historią (ON DELETE CASCADE). */
export function deleteHabit(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM habits WHERE id = ?', id);
}

export function setHabitCount(db: SQLiteDatabase, habitId: number, date: DateKey, count: number) {
  if (count <= 0) {
    return db.runAsync('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?', habitId, date);
  }
  return db.runAsync(
    `INSERT INTO habit_logs (habit_id, date, count) VALUES (?, ?, ?)
     ON CONFLICT (habit_id, date) DO UPDATE SET count = excluded.count`,
    habitId,
    date,
    count,
  );
}

/** Stuknięcie: +1, a po osiągnięciu celu z powrotem do zera. */
export function nextHabitCount(count: number, target: number) {
  return count >= target ? 0 : count + 1;
}
