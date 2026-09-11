import type { SQLiteDatabase } from 'expo-sqlite';

export type Note = {
  id: number;
  title: string;
  body: string;
  pinned: 0 | 1;
  created_at: string;
  updated_at: string;
  /** Id tagów po przecinku ('1,4') albo null — tylko w NOTES_SQL. */
  tag_ids?: string | null;
};

export type NoteContent = Pick<Note, 'title' | 'body'>;

export const NOTES_SQL = `
  SELECT notes.*, (SELECT GROUP_CONCAT(nt.tag_id) FROM note_tags nt WHERE nt.note_id = notes.id) AS tag_ids
  FROM notes ORDER BY pinned DESC, updated_at DESC`;

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
    `UPDATE notes SET title = $title, body = $body, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
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
