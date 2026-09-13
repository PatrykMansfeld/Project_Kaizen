import type { SQLiteDatabase } from 'expo-sqlite';

import type { MeasurementType } from '@/db/measurements';
import type { WorkoutType } from '@/features/activity/workout-types';
import type { DateKey } from '@/lib/dates';

export type GoalKind = 'distance' | 'workouts' | 'minutes' | 'habit' | 'measurement' | 'manual';

export type Goal = {
  id: number;
  title: string;
  kind: GoalKind;
  /** distance / workouts / minutes: tylko ten typ treningu (null = wszystkie). */
  workout_type: WorkoutType | null;
  habit_id: number | null;
  measurement_type: MeasurementType | null;
  /** measurement: wartość na starcie. */
  start_value: number | null;
  /** distance: km, workouts: sztuki, minutes: minuty, habit: dni, measurement: wartość docelowa, manual: ilość. */
  target: number;
  /** manual: jednostka, np. „książek”. */
  unit: string | null;
  /** manual: postęp wpisywany ręcznie. */
  progress: number;
  start_date: DateKey;
  end_date: DateKey;
  /** Dzień osiągnięcia celu (do Postępu) — raz zapisany zostaje. */
  achieved_on: DateKey | null;
  created_at: string;
};

export type GoalInput = Omit<Goal, 'id' | 'created_at' | 'progress' | 'achieved_on'>;

/** Najpierw trwające (najbliższy termin na górze), potem zakończone. */
export const GOALS_SQL = 'SELECT * FROM goals ORDER BY end_date < $today, end_date, id';

/** Postęp liczony z danych — jedno zapytanie zwracające kolumnę `value`. */
export function goalProgressQuery(goal: Goal): { sql: string; params: Record<string, string | number | null> } {
  const range = { $from: goal.start_date, $to: goal.end_date, $type: goal.workout_type };
  const workoutFilter = 'date BETWEEN $from AND $to AND ($type IS NULL OR type = $type)';
  switch (goal.kind) {
    case 'distance':
      return { sql: `SELECT COALESCE(SUM(distance_km), 0) AS value FROM workouts WHERE ${workoutFilter}`, params: range };
    case 'workouts':
      return { sql: `SELECT COUNT(*) AS value FROM workouts WHERE ${workoutFilter}`, params: range };
    case 'minutes':
      return { sql: `SELECT COALESCE(SUM(duration_min), 0) AS value FROM workouts WHERE ${workoutFilter}`, params: range };
    case 'habit':
      return {
        sql: `SELECT COUNT(*) AS value FROM habit_logs l JOIN habits h ON h.id = l.habit_id
              WHERE l.habit_id = $habit AND l.count >= h.target_per_day AND l.date BETWEEN $from AND $to`,
        params: { $habit: goal.habit_id, $from: goal.start_date, $to: goal.end_date },
      };
    case 'measurement':
      return {
        sql: 'SELECT value FROM measurements WHERE type = $measurement ORDER BY date DESC, id DESC LIMIT 1',
        params: { $measurement: goal.measurement_type },
      };
    case 'manual':
      return { sql: 'SELECT progress AS value FROM goals WHERE id = $id', params: { $id: goal.id } };
  }
}

/**
 * Postęp 0–1. Dla pomiaru liczymy drogę od wartości startowej do celu (działa w obie strony:
 * schudnąć z 82 do 78 kg albo przytyć), dla reszty — zebrane / cel.
 */
export function goalFraction(goal: Pick<Goal, 'kind' | 'target' | 'start_value'>, value: number | null) {
  if (value === null) return 0;
  if (goal.kind === 'measurement') {
    const start = goal.start_value ?? value;
    if (start === goal.target) return 1;
    return Math.min(Math.max((start - value) / (start - goal.target), 0), 1);
  }
  return Math.min(Math.max(value / goal.target, 0), 1);
}

export function getGoal(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Goal>('SELECT * FROM goals WHERE id = ?', id);
}

function toParams(input: GoalInput) {
  return {
    $title: input.title,
    $kind: input.kind,
    $workoutType: input.workout_type,
    $habit: input.habit_id,
    $measurement: input.measurement_type,
    $start: input.start_value,
    $target: input.target,
    $unit: input.unit,
    $from: input.start_date,
    $to: input.end_date,
  };
}

export function createGoal(db: SQLiteDatabase, input: GoalInput) {
  return db.runAsync(
    `INSERT INTO goals (title, kind, workout_type, habit_id, measurement_type, start_value, target, unit, start_date, end_date)
     VALUES ($title, $kind, $workoutType, $habit, $measurement, $start, $target, $unit, $from, $to)`,
    toParams(input),
  );
}

/** Po zmianie celu jego osiągnięcie liczy się od nowa (syncGoalAchievements). */
export function updateGoal(db: SQLiteDatabase, id: number, input: GoalInput) {
  return db.runAsync(
    `UPDATE goals SET title = $title, kind = $kind, workout_type = $workoutType, habit_id = $habit,
       measurement_type = $measurement, start_value = $start, target = $target, unit = $unit,
       start_date = $from, end_date = $to, achieved_on = NULL
     WHERE id = $id`,
    { ...toParams(input), $id: id },
  );
}

/**
 * Zapisuje dzień osiągnięcia celów, które doszły do 100% (punkty w Postępie). Cel zakończony w przeszłości
 * dostaje datę końca, a nie dzisiejszą.
 */
export async function syncGoalAchievements(db: SQLiteDatabase, today: DateKey) {
  const goals = await db.getAllAsync<Goal>('SELECT * FROM goals WHERE achieved_on IS NULL AND start_date <= ?', today);
  for (const goal of goals) {
    const query = goalProgressQuery(goal);
    const row = await db.getFirstAsync<{ value: number | null }>(query.sql, query.params);
    const value = row?.value ?? (goal.kind === 'measurement' ? null : 0);
    if (goalFraction(goal, value) >= 1) {
      await db.runAsync('UPDATE goals SET achieved_on = ? WHERE id = ?', goal.end_date < today ? goal.end_date : today, goal.id);
    }
  }
}

export function setGoalProgress(db: SQLiteDatabase, id: number, progress: number) {
  return db.runAsync('UPDATE goals SET progress = ? WHERE id = ?', Math.max(progress, 0), id);
}

export function deleteGoal(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM goals WHERE id = ?', id);
}
