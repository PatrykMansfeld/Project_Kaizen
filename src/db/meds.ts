import type { SQLiteDatabase } from 'expo-sqlite';

import type { Table } from '@/db/use-query';
import type { DateKey } from '@/lib/dates';

export type Medication = {
  id: number;
  name: string;
  /** Np. „1 tabletka”, „500 mg”. */
  dose: string;
  icon: string;
  color: string;
  /** Godziny dawek 'HH:MM' po przecinku; pusto = lek doraźny. */
  times: string;
  /** Dni tygodnia (jak w nawykach): bit 0 = poniedziałek … bit 6 = niedziela. */
  days_mask: number;
  /** Zapas w sztukach albo null (nie liczymy). */
  stock: number | null;
  /** Ile sztuk schodzi na jedną dawkę. */
  per_dose: number;
  reminders: 0 | 1;
  active: 0 | 1;
  notes: string;
  created_at: string;
};

export type MedicationInput = Pick<Medication, 'name' | 'dose' | 'icon' | 'color' | 'days_mask' | 'stock' | 'per_dose' | 'notes'> & {
  times: string[];
  reminders: boolean;
  active: boolean;
};

export type MedicationLog = { id: number; medication_id: number; date: DateKey; time: string; taken_at: string };

export const MED_TABLES: readonly Table[] = ['medications', 'medication_logs'];

export const MEDICATIONS_SQL = 'SELECT * FROM medications ORDER BY active DESC, name COLLATE NOCASE';

export const MED_LOGS_DAY_SQL = 'SELECT * FROM medication_logs WHERE date = $date ORDER BY time';

/** '08:00,20:00' → ['08:00', '20:00'] (posortowane, bez pustych). */
export function parseTimes(times: string) {
  return times
    .split(',')
    .map((time) => time.trim())
    .filter((time) => /^\d{2}:\d{2}$/.test(time))
    .sort();
}

export function getMedication(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Medication>('SELECT * FROM medications WHERE id = ?', id);
}

function toParams(input: MedicationInput) {
  return {
    $name: input.name,
    $dose: input.dose,
    $icon: input.icon,
    $color: input.color,
    $times: [...new Set(input.times)].sort().join(','),
    $days: input.days_mask,
    $stock: input.stock,
    $perDose: input.per_dose,
    $reminders: input.reminders ? 1 : 0,
    $active: input.active ? 1 : 0,
    $notes: input.notes,
  };
}

export function createMedication(db: SQLiteDatabase, input: MedicationInput) {
  return db.runAsync(
    `INSERT INTO medications (name, dose, icon, color, times, days_mask, stock, per_dose, reminders, active, notes)
     VALUES ($name, $dose, $icon, $color, $times, $days, $stock, $perDose, $reminders, $active, $notes)`,
    toParams(input),
  );
}

export function updateMedication(db: SQLiteDatabase, id: number, input: MedicationInput) {
  return db.runAsync(
    `UPDATE medications SET name = $name, dose = $dose, icon = $icon, color = $color, times = $times, days_mask = $days,
       stock = $stock, per_dose = $perDose, reminders = $reminders, active = $active, notes = $notes
     WHERE id = $id`,
    { ...toParams(input), $id: id },
  );
}

/** Usuwa lek razem z historią dawek. */
export function deleteMedication(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM medications WHERE id = ?', id);
}

/** Odhacza dawkę (dzień + godzina) i zmniejsza zapas. Drugie odhaczenie tej samej dawki nic nie robi. */
export async function takeDose(db: SQLiteDatabase, med: Pick<Medication, 'id'>, date: DateKey, time: string) {
  await db.withTransactionAsync(async () => {
    const { changes } = await db.runAsync(
      'INSERT OR IGNORE INTO medication_logs (medication_id, date, time) VALUES (?, ?, ?)',
      med.id,
      date,
      time,
    );
    if (changes > 0) {
      await db.runAsync('UPDATE medications SET stock = MAX(stock - per_dose, 0) WHERE id = ? AND stock IS NOT NULL', med.id);
    }
  });
}

/** Cofa dawkę i oddaje ją do zapasu. */
export async function untakeDose(db: SQLiteDatabase, med: Pick<Medication, 'id'>, date: DateKey, time: string) {
  await db.withTransactionAsync(async () => {
    const { changes } = await db.runAsync(
      'DELETE FROM medication_logs WHERE medication_id = ? AND date = ? AND time = ?',
      med.id,
      date,
      time,
    );
    if (changes > 0) {
      await db.runAsync('UPDATE medications SET stock = stock + per_dose WHERE id = ? AND stock IS NOT NULL', med.id);
    }
  });
}

/** Uzupełnienie zapasu (np. nowe opakowanie). */
export function addStock(db: SQLiteDatabase, id: number, amount: number) {
  return db.runAsync('UPDATE medications SET stock = COALESCE(stock, 0) + ? WHERE id = ?', amount, id);
}
