import type { SQLiteDatabase } from 'expo-sqlite';

export type SettingKey =
  | 'last_export_at'
  /** 'HH:MM' przypomnienia o wieczornym podsumowaniu dnia (brak = wyłączone). */
  | 'review_time'
  /** Ostatni dzień, dla którego zrobiono podsumowanie ('YYYY-MM-DD'). */
  | 'last_review_date'
  /** Ile razy zamknięto dzień podsumowaniem (do osiągnięć). */
  | 'review_count'
  /** 'D HH:MM' — dzień tygodnia (0 = pn … 6 = nd) i godzina przypomnienia o przeglądzie tygodnia. */
  | 'weekly_review_time'
  /** JSON z id osiągnięć, które użytkownik już widział. */
  | 'achievements_seen'
  /** Miesięczny budżet na wszystkie wydatki, w groszach (brak = bez budżetu). Trafia do kopii zapasowej. */
  | 'monthly_budget';

export const SETTING_SQL = 'SELECT value FROM settings WHERE key = $key';

export async function getSetting(db: SQLiteDatabase, key: SettingKey) {
  const row = await db.getFirstAsync<{ value: string }>(SETTING_SQL, { $key: key });
  return row?.value ?? null;
}

export function deleteSetting(db: SQLiteDatabase, key: SettingKey) {
  return db.runAsync('DELETE FROM settings WHERE key = ?', key);
}

export function setSetting(db: SQLiteDatabase, key: SettingKey, value: string) {
  return db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
