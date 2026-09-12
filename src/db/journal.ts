import type { SQLiteDatabase } from 'expo-sqlite';

import { NOW_SQL } from '@/db/sql';

import type { DateKey } from '@/lib/dates';

export type JournalEntry = {
  date: DateKey;
  /** 1–5 albo null, jeśli nie wybrano. */
  mood: number | null;
  body: string;
  updated_at: string;
};

export type JournalContent = Pick<JournalEntry, 'mood' | 'body'>;

/** Oceny nastroju z okresu (do statystyk i wniosków). */
export const MOODS_RANGE_SQL =
  'SELECT date, mood FROM journal_entries WHERE mood IS NOT NULL AND date BETWEEN $from AND $to ORDER BY date';

export type MoodRow = { date: DateKey; mood: number };

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
     VALUES ($date, $mood, $body, ${NOW_SQL})
     ON CONFLICT (date) DO UPDATE SET mood = excluded.mood, body = excluded.body, updated_at = excluded.updated_at`,
    { $date: date, $mood: mood, $body: body },
  );
}
