import type { SQLiteDatabase } from 'expo-sqlite';

import type { DateKey } from '@/lib/dates';

export type DreamCategory = 'travel' | 'adventure' | 'skill' | 'create' | 'people' | 'things' | 'other';

export type Dream = {
  id: number;
  title: string;
  /** Emoji. */
  icon: string;
  category: DreamCategory;
  /** Rok, do którego chcesz to zrobić (opcjonalnie). */
  target_year: number | null;
  note: string;
  /** Dzień spełnienia albo null (jeszcze przed tobą). */
  done_on: DateKey | null;
  /** Zdjęcie ze spełnienia (plik w katalogu aplikacji) albo null. */
  photo_uri: string | null;
  created_at: string;
};

export type DreamInput = Omit<Dream, 'id' | 'created_at'>;

/** Najpierw do spełnienia (najbliższy rok na górze, bez roku na końcu), potem spełnione od najnowszego. */
export const DREAMS_SQL = `SELECT * FROM dreams
  ORDER BY done_on IS NOT NULL, done_on DESC, target_year IS NULL, target_year, id`;

export function getDream(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Dream>('SELECT * FROM dreams WHERE id = ?', id);
}

function toParams(input: DreamInput) {
  return {
    $title: input.title,
    $icon: input.icon,
    $category: input.category,
    $year: input.target_year,
    $note: input.note,
    $done: input.done_on,
    // Zdjęcie ma sens tylko przy spełnionym marzeniu.
    $photo: input.done_on ? input.photo_uri : null,
  };
}

export async function createDream(db: SQLiteDatabase, input: DreamInput) {
  const result = await db.runAsync(
    `INSERT INTO dreams (title, icon, category, target_year, note, done_on, photo_uri)
     VALUES ($title, $icon, $category, $year, $note, $done, $photo)`,
    toParams(input),
  );
  return result.lastInsertRowId;
}

export function updateDream(db: SQLiteDatabase, id: number, input: DreamInput) {
  return db.runAsync(
    `UPDATE dreams SET title = $title, icon = $icon, category = $category, target_year = $year, note = $note,
       done_on = $done, photo_uri = $photo
     WHERE id = $id`,
    { ...toParams(input), $id: id },
  );
}

/** Spełnione (z dniem i opcjonalnym zdjęciem). */
export function markDreamDone(db: SQLiteDatabase, id: number, date: DateKey, photoUri: string | null) {
  return db.runAsync('UPDATE dreams SET done_on = ?, photo_uri = ? WHERE id = ?', date, photoUri, id);
}

export function deleteDream(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM dreams WHERE id = ?', id);
}
