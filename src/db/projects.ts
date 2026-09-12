import type { SQLiteDatabase } from 'expo-sqlite';

import { PALETTE_KEYS } from '@/theme/palette';

export type Project = {
  id: number;
  name: string;
  /** Klucz z palety theme/palette.ts. */
  color: string;
  archived: 0 | 1;
  created_at: string;
  open_count: number;
  done_count: number;
};

/** Projekty z liczbą otwartych i zrobionych zadań (do paska postępu). */
export const PROJECTS_SQL = `
  SELECT p.*,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.completed_at IS NULL) AS open_count,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.completed_at IS NOT NULL) AS done_count
  FROM projects p WHERE p.archived = 0 ORDER BY p.name COLLATE NOCASE`;

/** Nowy projekt dostaje kolejny kolor z palety. */
export async function createProject(db: SQLiteDatabase, name: string) {
  const count = (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM projects'))?.n ?? 0;
  const color = PALETTE_KEYS[(count + 2) % PALETTE_KEYS.length];
  return (await db.runAsync('INSERT INTO projects (name, color) VALUES (?, ?)', name, color)).lastInsertRowId;
}

export function renameProject(db: SQLiteDatabase, id: number, name: string) {
  return db.runAsync('UPDATE projects SET name = ? WHERE id = ?', name, id);
}

/** Zadania zostają — tracą tylko przypisanie do projektu (ON DELETE SET NULL). */
export function deleteProject(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM projects WHERE id = ?', id);
}
