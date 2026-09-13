import type { SQLiteDatabase } from 'expo-sqlite';

import { ALL_HABIT_DONE_DAYS_SQL } from '@/db/habits';
import { getSetting } from '@/db/settings';
import type { DayCount, XpData, XpHabit } from '@/features/progress/xp';
import type { DateKey } from '@/lib/dates';

/** Tabele, z których liczą się punkty — ich zmiana przelicza Postęp. */
export const XP_TABLES = new Set([
  'habits',
  'habit_logs',
  'tasks',
  'home_chores',
  'chore_logs',
  'transactions',
  'settings',
  'workouts',
  'workout_sets',
  'sleep_logs',
  'medication_logs',
  'measurements',
  'practice_sessions',
  'media_items',
  'journal_entries',
  'daily_reviews',
  'weekly_reviews',
  'goals',
  'dreams',
]);

const dates = (rows: { date: DateKey }[]) => rows.map((row) => row.date);

/** Cała historia potrzebna do punktów — zapytania agregujące, dni liczymy w features/progress/xp.ts. */
export async function loadXpData(db: SQLiteDatabase): Promise<XpData> {
  const [
    habits,
    habitDone,
    tasks,
    chores,
    bills,
    expenses,
    workouts,
    sessions,
    sleep,
    doses,
    measurements,
    practice,
    media,
    journal,
    reviews,
    weekly,
    goals,
    dreams,
    budget,
    budgetSince,
  ] = await Promise.all([
    db.getAllAsync<XpHabit>('SELECT id, attribute, days_mask, weekly_target, archived, created_at FROM habits'),
    db.getAllAsync<{ habit_id: number; date: DateKey }>(ALL_HABIT_DONE_DAYS_SQL),
    db.getAllAsync<{ completed_at: string }>('SELECT completed_at FROM tasks WHERE completed_at IS NOT NULL'),
    db.getAllAsync<DayCount>('SELECT date, COUNT(*) AS n FROM chore_logs GROUP BY date'),
    db.getAllAsync<DayCount>('SELECT date, COUNT(*) AS n FROM transactions WHERE bill_id IS NOT NULL GROUP BY date'),
    db.getAllAsync<{ month: string; total: number }>(
      "SELECT substr(date, 1, 7) AS month, SUM(amount) AS total FROM transactions WHERE type = 'expense' GROUP BY month",
    ),
    db.getAllAsync<DayCount>('SELECT date, COUNT(*) AS n FROM workouts GROUP BY date'),
    db.getAllAsync<{ exercise_id: number; date: DateKey; max_weight: number }>(
      `SELECT s.exercise_id, w.date, MAX(s.weight_kg) AS max_weight
       FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
       WHERE s.weight_kg > 0
       GROUP BY s.exercise_id, s.workout_id
       ORDER BY s.exercise_id, w.date, w.id`,
    ),
    db.getAllAsync<{ date: DateKey }>('SELECT date FROM sleep_logs'),
    db.getAllAsync<DayCount>('SELECT date, COUNT(*) AS n FROM medication_logs GROUP BY date'),
    db.getAllAsync<{ date: DateKey }>('SELECT DISTINCT date FROM measurements'),
    db.getAllAsync<{ date: DateKey; minutes: number }>('SELECT date, SUM(minutes) AS minutes FROM practice_sessions GROUP BY date'),
    db.getAllAsync<XpData['media'][number]>(
      "SELECT kind, finished_on FROM media_items WHERE status = 'done' AND finished_on IS NOT NULL",
    ),
    db.getAllAsync<{ date: DateKey }>("SELECT date FROM journal_entries WHERE mood IS NOT NULL OR TRIM(body) <> ''"),
    db.getAllAsync<{ date: DateKey }>('SELECT date FROM daily_reviews'),
    db.getAllAsync<{ date: DateKey }>('SELECT week_start AS date FROM weekly_reviews'),
    db.getAllAsync<XpData['goals'][number]>('SELECT kind, habit_id, achieved_on FROM goals WHERE achieved_on IS NOT NULL'),
    db.getAllAsync<{ date: DateKey }>('SELECT done_on AS date FROM dreams WHERE done_on IS NOT NULL'),
    getSetting(db, 'monthly_budget'),
    getSetting(db, 'budget_since'),
  ]);

  return {
    habits,
    habitDone,
    tasks: tasks.map((row) => row.completed_at),
    chores,
    bills,
    expenses,
    budget: budget ? Number(budget) || null : null,
    budgetSince,
    workouts,
    sessions,
    sleep: dates(sleep),
    doses,
    measurements: dates(measurements),
    practice,
    media,
    journal: dates(journal),
    reviews: dates(reviews),
    weekly: dates(weekly),
    goals,
    dreams: dates(dreams),
  };
}
