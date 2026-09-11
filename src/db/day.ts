import type { Habit } from '@/db/habits';
import { TASK_COLUMNS } from '@/db/tasks';
import { WORKOUT_COLUMNS } from '@/db/workouts';

export type DotKind = 'activity' | 'habits' | 'tasks' | 'journal';

/** Które moduły mają coś w danym dniu (kropki w kalendarzu). */
export const CALENDAR_DOTS_SQL = `
  SELECT DISTINCT date, 'activity' AS kind FROM workouts WHERE date BETWEEN $from AND $to
  UNION ALL
  SELECT DISTINCT date, 'habits' FROM habit_logs WHERE count > 0 AND date BETWEEN $from AND $to
  UNION ALL
  SELECT DISTINCT due_date, 'tasks' FROM tasks WHERE due_date BETWEEN $from AND $to
  UNION ALL
  SELECT date, 'journal' FROM journal_entries WHERE date BETWEEN $from AND $to`;

export type HabitWithCount = Habit & { count: number };

export const DAY_HABITS_SQL = `
  SELECT h.*, COALESCE(l.count, 0) AS count
  FROM habits h LEFT JOIN habit_logs l ON l.habit_id = h.id AND l.date = $date
  WHERE h.archived = 0
  ORDER BY h.sort_order, h.id`;

/** Zadania z terminem na ten dzień; dla dzisiaj ($withOverdue = 1) także otwarte zaległe. */
export const DAY_TASKS_SQL = `
  SELECT ${TASK_COLUMNS} FROM tasks
  WHERE due_date = $date OR ($withOverdue = 1 AND completed_at IS NULL AND due_date < $date)
  ORDER BY completed_at IS NOT NULL, due_date, due_time IS NULL, due_time, priority DESC, id`;

export const DAY_WORKOUTS_SQL = `SELECT ${WORKOUT_COLUMNS} FROM workouts WHERE date = $date ORDER BY id`;

export const DAY_JOURNAL_SQL = 'SELECT * FROM journal_entries WHERE date = $date';
