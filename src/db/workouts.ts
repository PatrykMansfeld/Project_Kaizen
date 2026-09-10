import type { SQLiteDatabase } from 'expo-sqlite';

import type { WorkoutType } from '@/features/activity/workout-types';
import type { DateKey } from '@/lib/dates';

export type Workout = {
  id: number;
  type: WorkoutType;
  date: DateKey;
  duration_min: number | null;
  distance_km: number | null;
  note: string;
  created_at: string;
  /** Tylko w zapytaniach z WORKOUT_COLUMNS. */
  exercise_count?: number;
  set_count?: number;
};

/** Kolumny treningu razem z liczbą ćwiczeń i serii (siłownia). */
export const WORKOUT_COLUMNS = `*,
  (SELECT COUNT(DISTINCT exercise_id) FROM workout_sets s WHERE s.workout_id = workouts.id) AS exercise_count,
  (SELECT COUNT(*) FROM workout_sets s WHERE s.workout_id = workouts.id) AS set_count`;

export type WorkoutInput = Pick<Workout, 'type' | 'date' | 'duration_min' | 'distance_km' | 'note'>;

export type WorkoutTotals = { count: number; minutes: number; km: number };

/** $type = null → wszystkie typy. */
export const WORKOUTS_SQL = `
  SELECT ${WORKOUT_COLUMNS} FROM workouts
  WHERE $type IS NULL OR type = $type
  ORDER BY date DESC, id DESC`;

export const WORKOUT_TOTALS_SQL = `
  SELECT COUNT(*) AS count, COALESCE(SUM(duration_min), 0) AS minutes, COALESCE(SUM(distance_km), 0) AS km
  FROM workouts WHERE date BETWEEN $from AND $to`;

export function getWorkout(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', id);
}

function toParams(input: WorkoutInput) {
  return {
    $type: input.type,
    $date: input.date,
    $duration: input.duration_min,
    $distance: input.distance_km,
    $note: input.note,
  };
}

export function createWorkout(db: SQLiteDatabase, input: WorkoutInput) {
  return db.runAsync(
    `INSERT INTO workouts (type, date, duration_min, distance_km, note)
     VALUES ($type, $date, $duration, $distance, $note)`,
    toParams(input),
  );
}

export function updateWorkout(db: SQLiteDatabase, id: number, input: WorkoutInput) {
  return db.runAsync(
    `UPDATE workouts SET type = $type, date = $date, duration_min = $duration, distance_km = $distance, note = $note
     WHERE id = $id`,
    { ...toParams(input), $id: id },
  );
}

export function deleteWorkout(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM workouts WHERE id = ?', id);
}
