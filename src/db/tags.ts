import type { SQLiteDatabase } from 'expo-sqlite';

import { PALETTE_KEYS } from '@/theme/palette';

export type Tag = { id: number; name: string; color: string };

export const TAGS_SQL = 'SELECT * FROM tags ORDER BY name COLLATE NOCASE';

/** Lista id tagów z GROUP_CONCAT ('1,4') → [1, 4]. */
export function parseTagIds(value: string | null | undefined) {
  return value ? value.split(',').map(Number) : [];
}

/** Tworzy tag (kolor po kolei z palety); jeśli taki już jest, zwraca istniejący. */
export async function createTag(db: SQLiteDatabase, name: string): Promise<Tag> {
  const existing = await db.getFirstAsync<Tag>('SELECT * FROM tags WHERE name = ?', name);
  if (existing) return existing;
  const count = (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM tags'))?.n ?? 0;
  const color = PALETTE_KEYS[count % PALETTE_KEYS.length];
  const result = await db.runAsync('INSERT INTO tags (name, color) VALUES (?, ?)', name, color);
  return { id: result.lastInsertRowId, name, color };
}

export function deleteTag(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM tags WHERE id = ?', id);
}

export async function getTaskTagIds(db: SQLiteDatabase, taskId: number) {
  const rows = await db.getAllAsync<{ tag_id: number }>('SELECT tag_id FROM task_tags WHERE task_id = ?', taskId);
  return rows.map((row) => row.tag_id);
}

export async function getNoteTagIds(db: SQLiteDatabase, noteId: number) {
  const rows = await db.getAllAsync<{ tag_id: number }>('SELECT tag_id FROM note_tags WHERE note_id = ?', noteId);
  return rows.map((row) => row.tag_id);
}

/** Podmienia tagi zadania. Nie otwiera własnej transakcji — wywołuj wewnątrz zapisu zadania. */
export async function setTaskTags(db: SQLiteDatabase, taskId: number, tagIds: number[]) {
  await db.runAsync('DELETE FROM task_tags WHERE task_id = ?', taskId);
  for (const tagId of tagIds) {
    await db.runAsync('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', taskId, tagId);
  }
}

export async function setNoteTags(db: SQLiteDatabase, noteId: number, tagIds: number[]) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM note_tags WHERE note_id = ?', noteId);
    for (const tagId of tagIds) {
      await db.runAsync('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)', noteId, tagId);
    }
  });
}
