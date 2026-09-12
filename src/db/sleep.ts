import type { SQLiteDatabase } from 'expo-sqlite';

import { NOW_SQL } from '@/db/sql';

import type { DateKey } from '@/lib/dates';

/** Sen przypisany do dnia pobudki (noc z 9 na 10 września = 10 września). */
export type SleepLog = {
  date: DateKey;
  /** 'HH:MM' */
  bedtime: string;
  wake_time: string;
  duration_min: number;
  quality: number | null;
  updated_at: string;
};

export type SleepInput = Pick<SleepLog, 'bedtime' | 'wake_time' | 'quality'>;

export const SLEEP_QUALITY = [
  { value: 1, emoji: '😫', label: 'Fatalnie' },
  { value: 2, emoji: '🥱', label: 'Słabo' },
  { value: 3, emoji: '😐', label: 'Średnio' },
  { value: 4, emoji: '🙂', label: 'Dobrze' },
  { value: 5, emoji: '🤩', label: 'Świetnie' },
] as const;

export const SLEEP_RANGE_SQL = 'SELECT * FROM sleep_logs WHERE date BETWEEN $from AND $to ORDER BY date';

export const SLEEP_DAY_SQL = 'SELECT * FROM sleep_logs WHERE date = $date';

/** Minuty snu między godziną zaśnięcia a pobudki — także przez północ (23:30 → 7:00 = 450). */
export function sleepDuration(bedtime: string, wakeTime: string) {
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const diff = toMinutes(wakeTime) - toMinutes(bedtime);
  return diff > 0 ? diff : diff + 24 * 60;
}

export function getSleep(db: SQLiteDatabase, date: DateKey) {
  return db.getFirstAsync<SleepLog>('SELECT * FROM sleep_logs WHERE date = ?', date);
}

/** Ostatni zapisany sen — jego godziny podpowiadają się przy nowym wpisie. */
export function getLatestSleep(db: SQLiteDatabase) {
  return db.getFirstAsync<SleepLog>('SELECT * FROM sleep_logs ORDER BY date DESC LIMIT 1');
}

export function saveSleep(db: SQLiteDatabase, date: DateKey, input: SleepInput) {
  return db.runAsync(
    `INSERT INTO sleep_logs (date, bedtime, wake_time, duration_min, quality, updated_at)
     VALUES ($date, $bed, $wake, $duration, $quality, ${NOW_SQL})
     ON CONFLICT (date) DO UPDATE SET bedtime = excluded.bedtime, wake_time = excluded.wake_time,
       duration_min = excluded.duration_min, quality = excluded.quality, updated_at = excluded.updated_at`,
    {
      $date: date,
      $bed: input.bedtime,
      $wake: input.wake_time,
      $duration: sleepDuration(input.bedtime, input.wake_time),
      $quality: input.quality,
    },
  );
}

export function deleteSleep(db: SQLiteDatabase, date: DateKey) {
  return db.runAsync('DELETE FROM sleep_logs WHERE date = ?', date);
}
