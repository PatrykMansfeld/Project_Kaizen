import type { SQLiteDatabase } from 'expo-sqlite';

import type { ExerciseSetRow } from '@/features/activity/records';

export type Exercise = { id: number; name: string };

export const EXERCISES_SQL = 'SELECT id, name FROM exercises';

export type WorkoutSetRow = {
  id: number;
  workout_id: number;
  exercise_id: number;
  position: number;
  reps: number | null;
  weight_kg: number | null;
  exercise_name: string;
};

export type ExerciseSets = { exerciseId: number; sets: { reps: number; weight_kg: number | null }[] };

export function getWorkoutSets(db: SQLiteDatabase, workoutId: number) {
  return db.getAllAsync<WorkoutSetRow>(
    `SELECT s.*, e.name AS exercise_name
     FROM workout_sets s JOIN exercises e ON e.id = s.exercise_id
     WHERE s.workout_id = ? ORDER BY s.position`,
    workoutId,
  );
}

/** Dodaje ćwiczenie do katalogu; jeśli już jest (bez względu na wielkość liter), zwraca istniejące. */
export async function createExercise(db: SQLiteDatabase, name: string): Promise<Exercise> {
  const existing = await db.getFirstAsync<Exercise>('SELECT id, name FROM exercises WHERE name = ?', name);
  if (existing) return existing;
  const result = await db.runAsync('INSERT INTO exercises (name) VALUES (?)', name);
  return { id: result.lastInsertRowId, name };
}

/** Ostatnia seria danego ćwiczenia z innego treningu — do podpowiedzi powtórzeń i ciężaru. */
export function getLastSet(db: SQLiteDatabase, exerciseId: number, excludeWorkoutId: number | null) {
  return db.getFirstAsync<{ reps: number | null; weight_kg: number | null }>(
    `SELECT s.reps, s.weight_kg
     FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
     WHERE s.exercise_id = $exercise AND s.workout_id != $exclude
     ORDER BY w.date DESC, w.id DESC, s.position DESC
     LIMIT 1`,
    { $exercise: exerciseId, $exclude: excludeWorkoutId ?? -1 },
  );
}

/** Tabele serii: w treningu i w szablonie (ta sama budowa, inny „właściciel”). */
const SET_TABLES = {
  workout: { table: 'workout_sets', owner: 'workout_id' },
  template: { table: 'template_sets', owner: 'template_id' },
} as const;

/**
 * Zastępuje serie treningu albo szablonu; kolejność ćwiczeń i serii zapisuje się w `position`.
 * Nie otwiera własnej transakcji — wywołuj wewnątrz zapisu treningu / szablonu.
 */
export async function replaceSets(
  db: SQLiteDatabase,
  kind: keyof typeof SET_TABLES,
  ownerId: number,
  exercises: ExerciseSets[],
) {
  const { table, owner } = SET_TABLES[kind];
  await db.runAsync(`DELETE FROM ${table} WHERE ${owner} = ?`, ownerId);
  let position = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      await db.runAsync(
        `INSERT INTO ${table} (${owner}, exercise_id, position, reps, weight_kg) VALUES (?, ?, ?, ?, ?)`,
        ownerId,
        exercise.exerciseId,
        position++,
        set.reps,
        set.weight_kg,
      );
    }
  }
}

export function replaceWorkoutSets(db: SQLiteDatabase, workoutId: number, exercises: ExerciseSets[]) {
  return replaceSets(db, 'workout', workoutId, exercises);
}

/** Serie ćwiczenia z datami treningów (od najstarszego); $exclude = trening do pominięcia albo -1. */
export const EXERCISE_HISTORY_SQL = `
  SELECT s.workout_id, w.date, s.reps, s.weight_kg
  FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
  WHERE s.exercise_id = $exercise AND s.workout_id != $exclude
  ORDER BY w.date, w.id, s.position`;

/** Wszystkie serie ćwiczenia z datami treningów (od najstarszego) — do historii i rekordów. */
export function getExerciseHistory(db: SQLiteDatabase, exerciseId: number, excludeWorkoutId: number | null = null) {
  return db.getAllAsync<ExerciseSetRow>(EXERCISE_HISTORY_SQL, { $exercise: exerciseId, $exclude: excludeWorkoutId ?? -1 });
}

export type ExerciseSummary = Exercise & { sessions: number; last_date: string | null; max_weight: number | null };

/** Katalog ćwiczeń z liczbą treningów, ostatnią datą i największym ciężarem. */
export const EXERCISE_SUMMARY_SQL = `
  SELECT e.id, e.name,
    COUNT(DISTINCT s.workout_id) AS sessions,
    MAX(w.date) AS last_date,
    MAX(s.weight_kg) AS max_weight
  FROM exercises e
  LEFT JOIN workout_sets s ON s.exercise_id = e.id
  LEFT JOIN workouts w ON w.id = s.workout_id
  GROUP BY e.id
  ORDER BY sessions = 0, last_date DESC, e.name`;
