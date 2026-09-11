import type { SQLiteDatabase } from 'expo-sqlite';

import type { ExerciseSets } from '@/db/exercises';

export type WorkoutTemplate = {
  id: number;
  name: string;
  created_at: string;
  exercise_count: number;
  set_count: number;
};

export type TemplateSetRow = {
  exercise_id: number;
  exercise_name: string;
  position: number;
  reps: number | null;
  weight_kg: number | null;
};

export const TEMPLATES_SQL = `
  SELECT t.*,
    (SELECT COUNT(DISTINCT exercise_id) FROM template_sets s WHERE s.template_id = t.id) AS exercise_count,
    (SELECT COUNT(*) FROM template_sets s WHERE s.template_id = t.id) AS set_count
  FROM workout_templates t ORDER BY t.name COLLATE NOCASE`;

export function getTemplate(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<{ id: number; name: string }>('SELECT id, name FROM workout_templates WHERE id = ?', id);
}

export function getTemplateSets(db: SQLiteDatabase, templateId: number) {
  return db.getAllAsync<TemplateSetRow>(
    `SELECT s.exercise_id, e.name AS exercise_name, s.position, s.reps, s.weight_kg
     FROM template_sets s JOIN exercises e ON e.id = s.exercise_id
     WHERE s.template_id = ? ORDER BY s.position`,
    templateId,
  );
}

async function replaceTemplateSets(db: SQLiteDatabase, templateId: number, exercises: ExerciseSets[]) {
  await db.runAsync('DELETE FROM template_sets WHERE template_id = ?', templateId);
  let position = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      await db.runAsync(
        'INSERT INTO template_sets (template_id, exercise_id, position, reps, weight_kg) VALUES (?, ?, ?, ?, ?)',
        templateId,
        exercise.exerciseId,
        position++,
        set.reps,
        set.weight_kg,
      );
    }
  }
}

export async function createTemplate(db: SQLiteDatabase, name: string, exercises: ExerciseSets[]) {
  let id = 0;
  await db.withTransactionAsync(async () => {
    id = (await db.runAsync('INSERT INTO workout_templates (name) VALUES (?)', name)).lastInsertRowId;
    await replaceTemplateSets(db, id, exercises);
  });
  return id;
}

export async function updateTemplate(db: SQLiteDatabase, id: number, name: string, exercises: ExerciseSets[]) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE workout_templates SET name = ? WHERE id = ?', name, id);
    await replaceTemplateSets(db, id, exercises);
  });
}

export function deleteTemplate(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM workout_templates WHERE id = ?', id);
}
