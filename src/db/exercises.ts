import type { SQLiteDatabase } from 'expo-sqlite';

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

/** Zastępuje serie treningu; kolejność ćwiczeń i serii zapisuje się w `position`. */
export async function replaceWorkoutSets(db: SQLiteDatabase, workoutId: number, exercises: ExerciseSets[]) {
  await db.runAsync('DELETE FROM workout_sets WHERE workout_id = ?', workoutId);
  let position = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      await db.runAsync(
        'INSERT INTO workout_sets (workout_id, exercise_id, position, reps, weight_kg) VALUES (?, ?, ?, ?, ?)',
        workoutId,
        exercise.exerciseId,
        position++,
        set.reps,
        set.weight_kg,
      );
    }
  }
}
