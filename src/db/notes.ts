import type { SQLiteDatabase } from 'expo-sqlite';

import { NOW_SQL } from '@/db/sql';

export type Note = {
  id: number;
  title: string;
  body: string;
  pinned: 0 | 1;
  created_at: string;
  updated_at: string;
  /** Id tagów po przecinku ('1,4') albo null — tylko w NOTES_SQL. */
  tag_ids?: string | null;
  /** Liczba zdjęć — tylko w NOTES_SQL. */
  image_count?: number;
};

export type NoteImage = { id: number; note_id: number; uri: string; position: number };

export type NoteContent = Pick<Note, 'title' | 'body'>;

export const NOTES_SQL = `
  SELECT notes.*,
    (SELECT GROUP_CONCAT(nt.tag_id) FROM note_tags nt WHERE nt.note_id = notes.id) AS tag_ids,
    (SELECT COUNT(*) FROM note_images i WHERE i.note_id = notes.id) AS image_count
  FROM notes ORDER BY pinned DESC, updated_at DESC`;

export const NOTE_IMAGES_SQL = 'SELECT * FROM note_images WHERE note_id = $note ORDER BY position, id';

export function addNoteImage(db: SQLiteDatabase, noteId: number, uri: string) {
  return db.runAsync(
    `INSERT INTO note_images (note_id, uri, position)
     VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM note_images WHERE note_id = ?))`,
    noteId,
    uri,
    noteId,
  );
}

export function deleteNoteImage(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM note_images WHERE id = ?', id);
}

export async function getNoteImageUris(db: SQLiteDatabase, noteId: number) {
  return (await db.getAllAsync<{ uri: string }>('SELECT uri FROM note_images WHERE note_id = ?', noteId)).map((row) => row.uri);
}

export function isNoteEmpty({ title, body }: NoteContent) {
  return title.trim() === '' && body.trim() === '';
}

export function getNote(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?', id);
}

export async function createNote(db: SQLiteDatabase, content: NoteContent, pinned: boolean) {
  const result = await db.runAsync(
    'INSERT INTO notes (title, body, pinned) VALUES ($title, $body, $pinned)',
    { $title: content.title, $body: content.body, $pinned: pinned ? 1 : 0 },
  );
  return result.lastInsertRowId;
}

export function updateNote(db: SQLiteDatabase, id: number, content: NoteContent) {
  return db.runAsync(
    `UPDATE notes SET title = $title, body = $body, updated_at = ${NOW_SQL}
     WHERE id = $id`,
    { $id: id, $title: content.title, $body: content.body },
  );
}

export function setNotePinned(db: SQLiteDatabase, id: number, pinned: boolean) {
  return db.runAsync('UPDATE notes SET pinned = ? WHERE id = ?', pinned ? 1 : 0, id);
}

export function deleteNote(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM notes WHERE id = ?', id);
}
