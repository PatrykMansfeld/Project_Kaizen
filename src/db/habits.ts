import type { SQLiteDatabase } from 'expo-sqlite';

import { groupBy } from '@/lib/collections';
import type { DateKey } from '@/lib/dates';

export type Habit = {
  id: number;
  name: string;
  /** Emoji. */
  icon: string;
  /** Klucz z palety theme/palette.ts. */
  color: string;
  /** Cel na dzień: 1–5 dla licznika albo dowolna ilość, gdy jest `unit`. */
  target_per_day: number;
  /** null = licznik (stuknięcie = +1); inaczej jednostka ilości, np. 'kroków'. */
  unit: string | null;
  /** 'HH:MM' albo null (bez przypomnienia). */
  reminder_time: string | null;
  /** Dni tygodnia: bit 0 = poniedziałek … bit 6 = niedziela (features/habits/streak.ts). */
  days_mask: number;
  /** 1–7 = „tyle razy w tygodniu, w dowolne dni” (wtedy days_mask = codziennie); null = konkretne dni. */
  weekly_target: number | null;
  sort_order: number;
  archived: 0 | 1;
  created_at: string;
};

export type HabitInput = Pick<
  Habit,
  'name' | 'icon' | 'color' | 'target_per_day' | 'unit' | 'reminder_time' | 'days_mask' | 'weekly_target'
>;

export type HabitLog = { habit_id: number; date: DateKey; count: number };

export const HABITS_SQL = 'SELECT * FROM habits WHERE archived = 0 ORDER BY sort_order, id';

export const ARCHIVED_HABITS_SQL = 'SELECT * FROM habits WHERE archived = 1 ORDER BY name';

export const HABIT_LOGS_RANGE_SQL =
  'SELECT habit_id, date, count FROM habit_logs WHERE date BETWEEN $from AND $to';

/** Dni, w których cel został osiągnięty — do liczenia serii (tylko aktywne nawyki). */
export const HABIT_DONE_DAYS_SQL = `
  SELECT l.habit_id, l.date
  FROM habit_logs l JOIN habits h ON h.id = l.habit_id
  WHERE h.archived = 0 AND l.count >= h.target_per_day`;

/** Jak HABIT_DONE_DAYS_SQL, ale także z zarchiwizowanych nawyków (np. do osiągnięć). */
export const ALL_HABIT_DONE_DAYS_SQL = `
  SELECT l.habit_id, l.date
  FROM habit_logs l JOIN habits h ON h.id = l.habit_id
  WHERE l.count >= h.target_per_day`;

export type HabitDoneDay = Pick<HabitLog, 'habit_id' | 'date'>;

/** Wpisy z bazy → licznik dnia per nawyk: habit_id → (dzień → count). */
export function countsByHabit(logs: readonly HabitLog[]) {
  const result = new Map<number, Map<DateKey, number>>();
  for (const [habitId, rows] of groupBy(logs, (log) => log.habit_id)) {
    result.set(habitId, new Map(rows.map((row) => [row.date, row.count])));
  }
  return result;
}

/** Dni z osiągniętym celem per nawyk: habit_id → zbiór dni. */
export function doneDaysByHabit(rows: readonly HabitDoneDay[]) {
  const result = new Map<number, Set<DateKey>>();
  for (const [habitId, days] of groupBy(rows, (row) => row.habit_id)) {
    result.set(habitId, new Set(days.map((row) => row.date)));
  }
  return result;
}

export function getHabit(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ?', id);
}

function toParams(input: HabitInput) {
  return {
    $name: input.name,
    $icon: input.icon,
    $color: input.color,
    $target: input.target_per_day,
    $unit: input.unit,
    $reminder: input.reminder_time,
    // Cel tygodniowy oznacza dowolne dni — harmonogram dni tygodnia wtedy nie obowiązuje.
    $days: input.weekly_target ? 127 : input.days_mask,
    $weekly: input.weekly_target ?? null,
  };
}

export function createHabit(db: SQLiteDatabase, input: HabitInput) {
  return db.runAsync(
    `INSERT INTO habits (name, icon, color, target_per_day, unit, reminder_time, days_mask, weekly_target, sort_order)
     VALUES ($name, $icon, $color, $target, $unit, $reminder, $days, $weekly,
       (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM habits))`,
    toParams(input),
  );
}

export function updateHabit(db: SQLiteDatabase, id: number, input: HabitInput) {
  return db.runAsync(
    `UPDATE habits SET name = $name, icon = $icon, color = $color, target_per_day = $target, unit = $unit,
       reminder_time = $reminder, days_mask = $days, weekly_target = $weekly
     WHERE id = $id`,
    { ...toParams(input), $id: id },
  );
}

/** Archiwum: nawyk znika z list i przypomnień, ale historia zostaje. Przywrócony trafia na koniec listy. */
export function setHabitArchived(db: SQLiteDatabase, id: number, archived: boolean) {
  return db.runAsync(
    `UPDATE habits SET archived = $archived,
       sort_order = CASE WHEN $archived = 0 THEN (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM habits) ELSE sort_order END
     WHERE id = $id`,
    { $id: id, $archived: archived ? 1 : 0 },
  );
}

/** Przesuwa nawyk o jedno miejsce w górę (-1) lub w dół (+1) na liście aktywnych. */
export async function moveHabit(db: SQLiteDatabase, id: number, direction: -1 | 1) {
  const ids = (await db.getAllAsync<{ id: number }>('SELECT id FROM habits WHERE archived = 0 ORDER BY sort_order, id')).map(
    (row) => row.id,
  );
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  // Numerujemy od nowa, żeby kolejność zawsze była jednoznaczna.
  await db.withTransactionAsync(async () => {
    for (const [index, habitId] of ids.entries()) {
      await db.runAsync('UPDATE habits SET sort_order = ? WHERE id = ?', index + 1, habitId);
    }
  });
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

/** Stuknięcie w licznik: +1, a po osiągnięciu celu z powrotem do zera. */
export function nextHabitCount(count: number, target: number) {
  return count >= target ? 0 : count + 1;
}
