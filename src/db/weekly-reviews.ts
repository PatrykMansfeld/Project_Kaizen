import type { SQLiteDatabase } from 'expo-sqlite';

import { NOW_SQL } from '@/db/sql';

import type { DateKey } from '@/lib/dates';

export type WeeklyReview = {
  /** Poniedziałek tygodnia. */
  week_start: DateKey;
  went_well: string;
  improve: string;
  /** Priorytety na kolejny tydzień, po jednym w linii. */
  priorities: string;
  updated_at: string;
};

export type WeeklyReviewContent = Pick<WeeklyReview, 'went_well' | 'improve' | 'priorities'>;

export function getWeeklyReview(db: SQLiteDatabase, weekStart: DateKey) {
  return db.getFirstAsync<WeeklyReview>('SELECT * FROM weekly_reviews WHERE week_start = ?', weekStart);
}

/** Zapis przeglądu; pusty (same puste pola) usuwamy, żeby nie wyglądał na zrobiony. */
export function saveWeeklyReview(db: SQLiteDatabase, weekStart: DateKey, content: WeeklyReviewContent) {
  if (!content.went_well.trim() && !content.improve.trim() && !content.priorities.trim()) {
    return db.runAsync('DELETE FROM weekly_reviews WHERE week_start = ?', weekStart);
  }
  return db.runAsync(
    `INSERT INTO weekly_reviews (week_start, went_well, improve, priorities, updated_at)
     VALUES ($week, $well, $improve, $priorities, ${NOW_SQL})
     ON CONFLICT (week_start) DO UPDATE SET went_well = excluded.went_well, improve = excluded.improve,
       priorities = excluded.priorities, updated_at = excluded.updated_at`,
    { $week: weekStart, $well: content.went_well, $improve: content.improve, $priorities: content.priorities },
  );
}

/** Priorytety jako lista (puste linie i znaczniki listy pomijamy). */
export function parsePriorities(text: string) {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}
