import type { SQLiteDatabase } from 'expo-sqlite';

import type { DateKey } from '@/lib/dates';

export type MeasurementType = 'weight' | 'body_fat' | 'waist' | 'chest' | 'hips' | 'arm' | 'thigh';

export const MEASUREMENT_TYPES: Record<MeasurementType, { label: string; unit: string }> = {
  weight: { label: 'Waga', unit: 'kg' },
  body_fat: { label: 'Tkanka tłuszczowa', unit: '%' },
  waist: { label: 'Talia', unit: 'cm' },
  chest: { label: 'Klatka', unit: 'cm' },
  hips: { label: 'Biodra', unit: 'cm' },
  arm: { label: 'Ramię', unit: 'cm' },
  thigh: { label: 'Udo', unit: 'cm' },
};

export const MEASUREMENT_TYPE_KEYS = Object.keys(MEASUREMENT_TYPES) as MeasurementType[];

export type Measurement = { id: number; type: MeasurementType; date: DateKey; value: number; created_at: string };

export type MeasurementInput = Pick<Measurement, 'type' | 'date' | 'value'>;

/** Wszystkie pomiary jednego rodzaju, od najnowszego. */
export const MEASUREMENTS_SQL = 'SELECT * FROM measurements WHERE type = $type ORDER BY date DESC, id DESC';

export function getMeasurement(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Measurement>('SELECT * FROM measurements WHERE id = ?', id);
}

export function getLatestMeasurement(db: SQLiteDatabase, type: MeasurementType) {
  return db.getFirstAsync<Measurement>(
    'SELECT * FROM measurements WHERE type = ? ORDER BY date DESC, id DESC LIMIT 1',
    type,
  );
}

export function createMeasurement(db: SQLiteDatabase, input: MeasurementInput) {
  return db.runAsync(
    'INSERT INTO measurements (type, date, value) VALUES (?, ?, ?)',
    input.type,
    input.date,
    input.value,
  );
}

export function updateMeasurement(db: SQLiteDatabase, id: number, input: MeasurementInput) {
  return db.runAsync(
    'UPDATE measurements SET type = ?, date = ?, value = ? WHERE id = ?',
    input.type,
    input.date,
    input.value,
    id,
  );
}

export function deleteMeasurement(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM measurements WHERE id = ?', id);
}
