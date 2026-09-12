import type { SQLiteDatabase } from 'expo-sqlite';

import { getExerciseHistory, type ExerciseSets } from '@/db/exercises';
import type { DateKey } from '@/lib/dates';

export type ExerciseSetRow = { workout_id: number; date: DateKey; reps: number | null; weight_kg: number | null };

export type Session = {
  workoutId: number;
  date: DateKey;
  sets: { reps: number | null; weight: number | null }[];
  /** Najcięższa seria (kg) albo null, gdy ćwiczenie bez obciążenia. */
  maxWeight: number | null;
  /** Najlepsze szacowane 1RM z serii. */
  bestE1rm: number | null;
  /** Objętość: suma powtórzeń × ciężar. */
  volume: number;
  /** Najwięcej powtórzeń w jednej serii (ważne dla ćwiczeń z masą ciała). */
  maxReps: number;
};

/** Szacowany ciężar maksymalny na 1 powtórzenie (wzór Epleya). */
export function e1rm(weight: number, reps: number) {
  return reps <= 1 ? weight : weight * (1 + reps / 30);
}

/** Serie z bazy (posortowane datą) → treningi z najlepszymi wartościami, od najstarszego. */
export function summarizeSessions(rows: ExerciseSetRow[]): Session[] {
  const sessions = new Map<number, Session>();
  for (const row of rows) {
    let session = sessions.get(row.workout_id);
    if (!session) {
      session = { workoutId: row.workout_id, date: row.date, sets: [], maxWeight: null, bestE1rm: null, volume: 0, maxReps: 0 };
      sessions.set(row.workout_id, session);
    }
    session.sets.push({ reps: row.reps, weight: row.weight_kg });
    const reps = row.reps ?? 0;
    session.maxReps = Math.max(session.maxReps, reps);
    if (row.weight_kg !== null && row.weight_kg > 0) {
      session.maxWeight = Math.max(session.maxWeight ?? 0, row.weight_kg);
      if (reps > 0) session.bestE1rm = Math.max(session.bestE1rm ?? 0, e1rm(row.weight_kg, reps));
      session.volume += reps * row.weight_kg;
    }
  }
  return [...sessions.values()];
}

export type RecordKind = 'weight' | 'e1rm' | 'volume' | 'reps';

export type PersonalRecord = { kind: RecordKind; value: number; date: DateKey };

export const RECORD_LABELS: Record<RecordKind, string> = {
  weight: 'Największy ciężar',
  e1rm: 'Szacowane 1RM',
  volume: 'Największa objętość',
  reps: 'Najwięcej powtórzeń',
};

/** Rekordy osobiste z historii (najwcześniejsza sesja, w której padł dany rekord). */
export function personalRecords(sessions: Session[]): PersonalRecord[] {
  const pick = (kind: RecordKind, value: (session: Session) => number | null) => {
    let best: PersonalRecord | null = null;
    for (const session of sessions) {
      const v = value(session);
      if (v !== null && v > 0 && (!best || v > best.value)) best = { kind, value: v, date: session.date };
    }
    return best;
  };
  return [
    pick('weight', (s) => s.maxWeight),
    pick('e1rm', (s) => s.bestE1rm),
    pick('volume', (s) => s.volume || null),
    pick('reps', (s) => s.maxReps || null),
  ].filter((record): record is PersonalRecord => record !== null);
}

/**
 * Które rekordy pobija nowy trening względem wcześniejszej historii.
 * Pierwszy trening z danym ćwiczeniem nie jest „rekordem” — nie ma z czym porównać.
 */
export function newRecords(previous: Session[], current: Session): RecordKind[] {
  if (previous.length === 0) return [];
  const best = (value: (session: Session) => number | null) =>
    Math.max(0, ...previous.map((session) => value(session) ?? 0));
  const beaten: RecordKind[] = [];
  if ((current.maxWeight ?? 0) > best((s) => s.maxWeight)) beaten.push('weight');
  else if ((current.bestE1rm ?? 0) > best((s) => s.bestE1rm)) beaten.push('e1rm');
  if (current.volume > best((s) => s.volume)) beaten.push('volume');
  // Powtórzenia liczymy tylko dla ćwiczeń bez obciążenia (np. podciąganie, pompki).
  if (current.maxWeight === null && current.maxReps > best((s) => s.maxReps)) beaten.push('reps');
  return beaten;
}

/**
 * Rekordy pobite w zapisanym treningu względem pozostałych treningów z tymi ćwiczeniami —
 * po linii na ćwiczenie, np. „Martwy ciąg: największy ciężar, największa objętość”.
 */
export async function describeBeatenRecords(
  db: SQLiteDatabase,
  workoutId: number,
  date: DateKey,
  exercises: (ExerciseSets & { name: string })[],
) {
  const lines: string[] = [];
  for (const exercise of exercises) {
    const previous = summarizeSessions(await getExerciseHistory(db, exercise.exerciseId, workoutId));
    const [current] = summarizeSessions(
      exercise.sets.map((set) => ({ workout_id: workoutId, date, reps: set.reps, weight_kg: set.weight_kg })),
    );
    const kinds = current ? newRecords(previous, current) : [];
    if (kinds.length) lines.push(`${exercise.name}: ${kinds.map((kind) => RECORD_LABELS[kind].toLowerCase()).join(', ')}`);
  }
  return lines;
}
