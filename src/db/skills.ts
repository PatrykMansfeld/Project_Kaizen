import type { SQLiteDatabase } from 'expo-sqlite';

import type { Table } from '@/db/use-query';
import type { DateKey } from '@/lib/dates';

export type Skill = {
  id: number;
  name: string;
  icon: string;
  color: string;
  /** Cel w godzinach (np. 100) albo null. */
  goal_hours: number | null;
  archived: 0 | 1;
  sort_order: number;
  created_at: string;
};

/** Umiejętność z sumami — z SKILLS_SQL. */
export type SkillWithTotals = Skill & { total_minutes: number; week_minutes: number; last_date: DateKey | null };

export type SkillInput = Pick<Skill, 'name' | 'icon' | 'color' | 'goal_hours'>;

export type PracticeSession = { id: number; skill_id: number; date: DateKey; minutes: number; note: string; created_at: string };

export type SessionInput = Pick<PracticeSession, 'skill_id' | 'date' | 'minutes' | 'note'>;

export const SKILL_TABLES: readonly Table[] = ['skills', 'practice_sessions'];

/** $weekStart — poniedziałek bieżącego tygodnia. */
export const SKILLS_SQL = `
  SELECT s.*,
    COALESCE((SELECT SUM(minutes) FROM practice_sessions p WHERE p.skill_id = s.id), 0) AS total_minutes,
    COALESCE((SELECT SUM(minutes) FROM practice_sessions p WHERE p.skill_id = s.id AND p.date >= $weekStart), 0) AS week_minutes,
    (SELECT MAX(date) FROM practice_sessions p WHERE p.skill_id = s.id) AS last_date
  FROM skills s WHERE s.archived = 0 ORDER BY s.sort_order, s.id`;

export const SKILL_SQL = 'SELECT * FROM skills WHERE id = $id';

export const SESSIONS_SQL = 'SELECT * FROM practice_sessions WHERE skill_id = $skill ORDER BY date DESC, id DESC';

export function getSkill(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Skill>('SELECT * FROM skills WHERE id = ?', id);
}

function toParams(input: SkillInput) {
  return { $name: input.name, $icon: input.icon, $color: input.color, $goal: input.goal_hours };
}

export function createSkill(db: SQLiteDatabase, input: SkillInput) {
  return db.runAsync(
    `INSERT INTO skills (name, icon, color, goal_hours, sort_order)
     VALUES ($name, $icon, $color, $goal, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM skills))`,
    toParams(input),
  );
}

export function updateSkill(db: SQLiteDatabase, id: number, input: SkillInput) {
  return db.runAsync(
    'UPDATE skills SET name = $name, icon = $icon, color = $color, goal_hours = $goal WHERE id = $id',
    { ...toParams(input), $id: id },
  );
}

/** Usuwa umiejętność razem z sesjami. */
export function deleteSkill(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM skills WHERE id = ?', id);
}

export function addSession(db: SQLiteDatabase, input: SessionInput) {
  return db.runAsync(
    'INSERT INTO practice_sessions (skill_id, date, minutes, note) VALUES (?, ?, ?, ?)',
    input.skill_id,
    input.date,
    input.minutes,
    input.note,
  );
}

export function updateSession(db: SQLiteDatabase, id: number, input: Omit<SessionInput, 'skill_id'>) {
  return db.runAsync('UPDATE practice_sessions SET date = ?, minutes = ?, note = ? WHERE id = ?', input.date, input.minutes, input.note, id);
}

export function deleteSession(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM practice_sessions WHERE id = ?', id);
}
