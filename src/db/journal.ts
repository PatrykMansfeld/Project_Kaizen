import type { SQLiteDatabase } from 'expo-sqlite';

import type { DateKey } from '@/lib/dates';

export type JournalEntry = {
  date: DateKey;
  /** 1–5 albo null, jeśli nie wybrano. */
  mood: number | null;
  body: string;
  updated_at: string;
};

export type JournalContent = Pick<JournalEntry, 'mood' | 'body'>;

export function getJournalEntry(db: SQLiteDatabase, date: DateKey) {
  return db.getFirstAsync<JournalEntry>('SELECT * FROM journal_entries WHERE date = ?', date);
}

/** Zapisuje wpis dnia; pusty (bez nastroju i tekstu) usuwa, żeby nie zostawiał kropki w kalendarzu. */
export function saveJournalEntry(db: SQLiteDatabase, date: DateKey, { mood, body }: JournalContent) {
  if (mood === null && body.trim() === '') {
    return db.runAsync('DELETE FROM journal_entries WHERE date = ?', date);
  }
  return db.runAsync(
    `INSERT INTO journal_entries (date, mood, body, updated_at)
     VALUES ($date, $mood, $body, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT (date) DO UPDATE SET mood = excluded.mood, body = excluded.body, updated_at = excluded.updated_at`,
    { $date: date, $mood: mood, $body: body },
  );
}
