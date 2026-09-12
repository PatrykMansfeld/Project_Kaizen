import type { SQLiteDatabase } from 'expo-sqlite';

import type { Table } from '@/db/use-query';
import { addDays, type DateKey } from '@/lib/dates';

export type Chore = {
  id: number;
  name: string;
  icon: string;
  /** Co ile dni. */
  interval_days: number;
  next_due: DateKey;
  last_done: DateKey | null;
  remind: 0 | 1;
  note: string;
  created_at: string;
};

export type ChoreInput = Pick<Chore, 'name' | 'icon' | 'interval_days' | 'next_due' | 'note'> & { remind: boolean };

export type Warranty = {
  id: number;
  name: string;
  purchase_date: DateKey | null;
  expires_on: DateKey;
  /** Cena w groszach albo null. */
  price: number | null;
  store: string;
  note: string;
  created_at: string;
};

export type WarrantyInput = Pick<Warranty, 'name' | 'purchase_date' | 'expires_on' | 'price' | 'store' | 'note'>;

export type Meter = { id: number; name: string; unit: string; icon: string; created_at: string };

export type MeterInput = Pick<Meter, 'name' | 'unit' | 'icon'>;

/** Licznik z ostatnimi dwoma odczytami — z METERS_SQL. */
export type MeterWithReadings = Meter & {
  last_value: number | null;
  last_date: DateKey | null;
  prev_value: number | null;
  prev_date: DateKey | null;
};

export type MeterReading = { id: number; meter_id: number; date: DateKey; value: number; created_at: string };

export const HOME_TABLES: readonly Table[] = ['home_chores', 'warranties', 'meters', 'meter_readings'];

export const CHORES_SQL = 'SELECT * FROM home_chores ORDER BY next_due, name';

/** Obowiązki na dziś i zaległe — do skrótu na ekranie Dziś. */
export const CHORES_DUE_COUNT_SQL = 'SELECT COUNT(*) AS n FROM home_chores WHERE next_due <= $today';

/** Najpierw ważne (od najbliższego końca), potem wygasłe. */
export const WARRANTIES_SQL = 'SELECT * FROM warranties ORDER BY expires_on < $today, expires_on';

const READING = (offset: number, column: string) =>
  `(SELECT ${column} FROM meter_readings r WHERE r.meter_id = m.id ORDER BY r.date DESC, r.id DESC LIMIT 1 OFFSET ${offset})`;

export const METERS_SQL = `
  SELECT m.*,
    ${READING(0, 'value')} AS last_value, ${READING(0, 'date')} AS last_date,
    ${READING(1, 'value')} AS prev_value, ${READING(1, 'date')} AS prev_date
  FROM meters m ORDER BY m.name COLLATE NOCASE`;

export const METER_SQL = 'SELECT * FROM meters WHERE id = $id';

export const METER_READINGS_SQL = 'SELECT * FROM meter_readings WHERE meter_id = $meter ORDER BY date DESC, id DESC';

// ——— Obowiązki

export function getChore(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Chore>('SELECT * FROM home_chores WHERE id = ?', id);
}

function choreParams(input: ChoreInput) {
  return {
    $name: input.name,
    $icon: input.icon,
    $interval: input.interval_days,
    $due: input.next_due,
    $remind: input.remind ? 1 : 0,
    $note: input.note,
  };
}

export function createChore(db: SQLiteDatabase, input: ChoreInput) {
  return db.runAsync(
    `INSERT INTO home_chores (name, icon, interval_days, next_due, remind, note)
     VALUES ($name, $icon, $interval, $due, $remind, $note)`,
    choreParams(input),
  );
}

export function updateChore(db: SQLiteDatabase, id: number, input: ChoreInput) {
  return db.runAsync(
    `UPDATE home_chores SET name = $name, icon = $icon, interval_days = $interval, next_due = $due, remind = $remind, note = $note
     WHERE id = $id`,
    { ...choreParams(input), $id: id },
  );
}

/** „Zrobione”: kolejny termin liczy się od dnia wykonania. */
export function markChoreDone(db: SQLiteDatabase, chore: Pick<Chore, 'id' | 'interval_days'>, today: DateKey) {
  return db.runAsync(
    'UPDATE home_chores SET last_done = ?, next_due = ? WHERE id = ?',
    today,
    addDays(today, chore.interval_days),
    chore.id,
  );
}

export function deleteChore(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM home_chores WHERE id = ?', id);
}

// ——— Gwarancje

export function getWarranty(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Warranty>('SELECT * FROM warranties WHERE id = ?', id);
}

function warrantyParams(input: WarrantyInput) {
  return {
    $name: input.name,
    $purchase: input.purchase_date,
    $expires: input.expires_on,
    $price: input.price,
    $store: input.store,
    $note: input.note,
  };
}

export function createWarranty(db: SQLiteDatabase, input: WarrantyInput) {
  return db.runAsync(
    `INSERT INTO warranties (name, purchase_date, expires_on, price, store, note)
     VALUES ($name, $purchase, $expires, $price, $store, $note)`,
    warrantyParams(input),
  );
}

export function updateWarranty(db: SQLiteDatabase, id: number, input: WarrantyInput) {
  return db.runAsync(
    `UPDATE warranties SET name = $name, purchase_date = $purchase, expires_on = $expires, price = $price, store = $store,
       note = $note
     WHERE id = $id`,
    { ...warrantyParams(input), $id: id },
  );
}

export function deleteWarranty(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM warranties WHERE id = ?', id);
}

// ——— Liczniki

export function getMeter(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Meter>('SELECT * FROM meters WHERE id = ?', id);
}

export async function createMeter(db: SQLiteDatabase, input: MeterInput) {
  return (await db.runAsync('INSERT INTO meters (name, unit, icon) VALUES (?, ?, ?)', input.name, input.unit, input.icon))
    .lastInsertRowId;
}

export function updateMeter(db: SQLiteDatabase, id: number, input: MeterInput) {
  return db.runAsync('UPDATE meters SET name = ?, unit = ?, icon = ? WHERE id = ?', input.name, input.unit, input.icon, id);
}

/** Usuwa licznik razem z odczytami. */
export function deleteMeter(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM meters WHERE id = ?', id);
}

export function addReading(db: SQLiteDatabase, meterId: number, date: DateKey, value: number) {
  return db.runAsync('INSERT INTO meter_readings (meter_id, date, value) VALUES (?, ?, ?)', meterId, date, value);
}

export function deleteReading(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM meter_readings WHERE id = ?', id);
}
