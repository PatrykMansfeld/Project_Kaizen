import type { SQLiteDatabase } from 'expo-sqlite';

export type SettingKey = 'last_export_at';

export const SETTING_SQL = 'SELECT value FROM settings WHERE key = $key';

export async function getSetting(db: SQLiteDatabase, key: SettingKey) {
  const row = await db.getFirstAsync<{ value: string }>(SETTING_SQL, { $key: key });
  return row?.value ?? null;
}

export function setSetting(db: SQLiteDatabase, key: SettingKey, value: string) {
  return db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
