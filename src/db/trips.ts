import type { SQLiteDatabase } from 'expo-sqlite';

import { TRANSACTION_SELECT } from '@/db/finance';
import type { Table } from '@/db/use-query';
import type { DateKey } from '@/lib/dates';

export type Trip = {
  id: number;
  name: string;
  destination: string;
  icon: string;
  color: string;
  start_date: DateKey;
  end_date: DateKey;
  /** Budżet w groszach albo null. */
  budget: number | null;
  note: string;
  created_at: string;
};

/** Podróż z licznikami — z TRIPS_SQL. */
export type TripWithTotals = Trip & {
  pack_total: number;
  pack_done: number;
  /** Suma wydatków z wyjazdu (grosze). */
  spent: number;
  photo_count: number;
  /** Pierwsze zdjęcie (okładka) albo null. */
  cover_uri: string | null;
};

export type TripInput = Pick<Trip, 'name' | 'destination' | 'icon' | 'color' | 'start_date' | 'end_date' | 'budget' | 'note'>;

export type TripItemKind = 'pack' | 'plan';

export type TripItem = {
  id: number;
  trip_id: number;
  kind: TripItemKind;
  text: string;
  /** Kategoria na liście pakowania (np. „Ubrania”); w planie pusta. */
  category: string;
  done: 0 | 1;
  /** Plan: dzień wyjazdu (null = pomysł bez dnia) i godzina 'HH:MM'. */
  date: DateKey | null;
  time: string | null;
  sort_order: number;
  created_at: string;
};

export type TripPhoto = { id: number; trip_id: number; uri: string; position: number; created_at: string };

export const TRIP_TABLES: readonly Table[] = ['trips', 'trip_items', 'trip_photos', 'transactions'];

export const TRIPS_SQL = `
  SELECT t.*,
    (SELECT COUNT(*) FROM trip_items i WHERE i.trip_id = t.id AND i.kind = 'pack') AS pack_total,
    (SELECT COUNT(*) FROM trip_items i WHERE i.trip_id = t.id AND i.kind = 'pack' AND i.done = 1) AS pack_done,
    COALESCE((SELECT SUM(amount) FROM transactions x WHERE x.trip_id = t.id AND x.type = 'expense'), 0) AS spent,
    (SELECT COUNT(*) FROM trip_photos p WHERE p.trip_id = t.id) AS photo_count,
    (SELECT uri FROM trip_photos p WHERE p.trip_id = t.id ORDER BY position, id LIMIT 1) AS cover_uri
  FROM trips t
  ORDER BY t.start_date DESC, t.id DESC`;

/** Jedna podróż z licznikami ($id). */
export const TRIP_SQL = TRIPS_SQL.replace('FROM trips t', 'FROM trips t WHERE t.id = $id');

/** Podróże do wyboru przy wydatku (bez liczników). */
export const TRIP_OPTIONS_SQL = 'SELECT * FROM trips ORDER BY start_date DESC, id DESC';

export const TRIP_ITEMS_SQL = `
  SELECT * FROM trip_items WHERE trip_id = $trip
  ORDER BY date IS NULL, date, time IS NULL, time, sort_order, id`;

export const TRIP_PHOTOS_SQL = 'SELECT * FROM trip_photos WHERE trip_id = $trip ORDER BY position, id';

export const TRIP_TRANSACTIONS_SQL = `${TRANSACTION_SELECT} WHERE t.trip_id = $trip ORDER BY t.date DESC, t.id DESC`;

export function getTrip(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Trip>('SELECT * FROM trips WHERE id = ?', id);
}

function tripParams(input: TripInput) {
  return {
    $name: input.name,
    $destination: input.destination,
    $icon: input.icon,
    $color: input.color,
    $start: input.start_date,
    $end: input.end_date,
    $budget: input.budget,
    $note: input.note,
  };
}

export function createTrip(db: SQLiteDatabase, input: TripInput) {
  return db.runAsync(
    `INSERT INTO trips (name, destination, icon, color, start_date, end_date, budget, note)
     VALUES ($name, $destination, $icon, $color, $start, $end, $budget, $note)`,
    tripParams(input),
  );
}

/**
 * Zmiana dat przesuwa dni w planie razem z wyjazdem (plan na „dzień 2” zostaje dniem 2);
 * punkty, które wypadłyby poza nowy termin, trafiają do pomysłów bez dnia.
 */
export async function updateTrip(db: SQLiteDatabase, id: number, input: TripInput) {
  await db.withTransactionAsync(async () => {
    const before = await getTrip(db, id);
    await db.runAsync(
      `UPDATE trips SET name = $name, destination = $destination, icon = $icon, color = $color, start_date = $start,
         end_date = $end, budget = $budget, note = $note
       WHERE id = $id`,
      { ...tripParams(input), $id: id },
    );
    if (before && before.start_date !== input.start_date) {
      await db.runAsync(
        `UPDATE trip_items SET date = date(date, printf('%+d days', CAST(round(julianday($start) - julianday($oldStart)) AS INTEGER)))
         WHERE trip_id = $id AND date IS NOT NULL`,
        { $start: input.start_date, $oldStart: before.start_date, $id: id },
      );
    }
    await db.runAsync(
      'UPDATE trip_items SET date = NULL, time = NULL WHERE trip_id = $id AND (date < $start OR date > $end)',
      { $id: id, $start: input.start_date, $end: input.end_date },
    );
  });
}

/** Usuwa podróż z planem, listą i wpisami zdjęć (pliki usuwa wywołujący); wydatki zostają bez podróży. */
export function deleteTrip(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM trips WHERE id = ?', id);
}

export type NewTripItem = Pick<TripItem, 'kind' | 'text' | 'category' | 'date' | 'time'>;

/** Dodaje punkty na koniec listy (w podanej kolejności). */
export async function addTripItems(db: SQLiteDatabase, tripId: number, items: readonly NewTripItem[]) {
  if (items.length === 0) return;
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ max: number | null }>('SELECT MAX(sort_order) AS max FROM trip_items WHERE trip_id = ?', tripId);
    let order = row?.max ?? 0;
    for (const item of items) {
      await db.runAsync(
        'INSERT INTO trip_items (trip_id, kind, text, category, date, time, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
        tripId,
        item.kind,
        item.text,
        item.category,
        item.date,
        item.time,
        ++order,
      );
    }
  });
}

export function updateTripItem(db: SQLiteDatabase, id: number, input: Pick<TripItem, 'text' | 'category' | 'date' | 'time'>) {
  return db.runAsync(
    'UPDATE trip_items SET text = ?, category = ?, date = ?, time = ? WHERE id = ?',
    input.text,
    input.category,
    input.date,
    input.time,
    id,
  );
}

export function toggleTripItem(db: SQLiteDatabase, item: Pick<TripItem, 'id' | 'done'>) {
  return db.runAsync('UPDATE trip_items SET done = ? WHERE id = ?', item.done ? 0 : 1, item.id);
}

export function deleteTripItem(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM trip_items WHERE id = ?', id);
}

/** Odznacza całą listę pakowania — np. przed pakowaniem na powrót. */
export function unpackAll(db: SQLiteDatabase, tripId: number) {
  return db.runAsync("UPDATE trip_items SET done = 0 WHERE trip_id = ? AND kind = 'pack'", tripId);
}

export function addTripPhoto(db: SQLiteDatabase, tripId: number, uri: string) {
  return db.runAsync(
    `INSERT INTO trip_photos (trip_id, uri, position)
     VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM trip_photos WHERE trip_id = ?))`,
    tripId,
    uri,
    tripId,
  );
}

export function deleteTripPhoto(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM trip_photos WHERE id = ?', id);
}

export async function getTripPhotoUris(db: SQLiteDatabase, tripId: number) {
  const rows = await db.getAllAsync<{ uri: string }>('SELECT uri FROM trip_photos WHERE trip_id = ?', tripId);
  return rows.map((row) => row.uri);
}
