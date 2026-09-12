import type { SQLiteDatabase } from 'expo-sqlite';

import type { SettingKey } from '@/db/settings';
import { plural } from '@/lib/format';

/**
 * Kopia zapasowa to JSON ze wszystkimi wierszami tabel. Import przepisuje tylko kolumny, które istnieją
 * w obecnej bazie, więc stare kopie da się wczytać po zmianach schematu (nowe kolumny dostaną domyślne wartości).
 */

/**
 * Tabele w kopii, w kolejności wstawiania (rodzice przed dziećmi). Ustawienia urządzenia nie trafiają do kopii
 * (poza BACKUP_SETTINGS), podobnie zdjęcia z notatek (to pliki, nie da się ich sensownie zapisać w JSON-ie).
 */
export const BACKUP_TABLES = [
  'exercises',
  'workouts',
  'workout_sets',
  'habits',
  'habit_logs',
  'tags',
  'projects',
  'tasks',
  'subtasks',
  'task_tags',
  'notes',
  'note_tags',
  'journal_entries',
  'measurements',
  'goals',
  'workout_templates',
  'template_sets',
  'sleep_logs',
  'weekly_reviews',
  'finance_categories',
  'recurring_bills',
  'transactions',
  'medications',
  'medication_logs',
  'skills',
  'practice_sessions',
  'home_chores',
  'warranties',
  'meters',
  'meter_readings',
] as const;

/** Ustawienia, które są danymi (a nie preferencjami telefonu) — trafiają do kopii. */
const BACKUP_SETTINGS: SettingKey[] = ['monthly_budget'];

type BackupTable = (typeof BACKUP_TABLES)[number];
type Value = string | number | null;
type Row = Record<string, Value>;

const FORMAT = 1;

export type Backup = {
  app: 'kaizen';
  format: number;
  schemaVersion: number;
  exportedAt: string;
  data: Partial<Record<BackupTable, Row[]>>;
  /** Wybrane ustawienia (BACKUP_SETTINGS); brak w kopiach sprzed ich dodania. */
  settings?: Record<string, string>;
};

/** Błąd z komunikatem do pokazania użytkownikowi. */
export class BackupError extends Error {}

export async function createBackup(db: SQLiteDatabase): Promise<Backup> {
  const data: Backup['data'] = {};
  for (const table of BACKUP_TABLES) {
    data[table] = await db.getAllAsync<Row>(`SELECT * FROM ${table}`);
  }
  const settingRows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN (${BACKUP_SETTINGS.map(() => '?').join(', ')})`,
    BACKUP_SETTINGS,
  );
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return {
    app: 'kaizen',
    format: FORMAT,
    schemaVersion: version?.user_version ?? 0,
    exportedAt: new Date().toISOString(),
    data,
    settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRow(value: unknown): value is Row {
  return (
    isObject(value) &&
    Object.values(value).every((field) => field === null || typeof field === 'string' || typeof field === 'number')
  );
}

/** Sprawdza zawartość pliku; rzuca BackupError z opisem, co jest nie tak. */
export function parseBackup(text: string): Backup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('To nie jest plik kopii zapasowej (niepoprawny format).');
  }
  if (!isObject(json) || json.app !== 'kaizen' || !isObject(json.data)) {
    throw new BackupError('Ten plik nie jest kopią zapasową Kaizen.');
  }
  if (typeof json.format !== 'number' || json.format > FORMAT) {
    throw new BackupError('Ta kopia pochodzi z nowszej wersji aplikacji. Zaktualizuj Kaizen i spróbuj ponownie.');
  }

  const data: Backup['data'] = {};
  for (const table of BACKUP_TABLES) {
    const rows = json.data[table];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || !rows.every(isRow)) {
      throw new BackupError(`Kopia jest uszkodzona (tabela ${table}).`);
    }
    data[table] = rows;
  }

  const backup: Backup = {
    app: 'kaizen',
    format: json.format,
    schemaVersion: typeof json.schemaVersion === 'number' ? json.schemaVersion : 0,
    exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : '',
    data,
  };
  if (isObject(json.settings)) {
    const settings = json.settings;
    backup.settings = Object.fromEntries(
      BACKUP_SETTINGS.filter((key) => typeof settings[key] === 'string').map((key) => [key, settings[key] as string]),
    );
  }
  checkReferences(backup);
  return backup;
}

/** Sprawdza powiązania przed importem, żeby uszkodzona kopia nie zaczęła podmieniać danych. */
function checkReferences({ data }: Backup) {
  const ids = (rows: Row[] | undefined) => new Set((rows ?? []).map((row) => row.id));
  const references: [BackupTable, string, BackupTable][] = [
    ['habit_logs', 'habit_id', 'habits'],
    ['workout_sets', 'workout_id', 'workouts'],
    ['workout_sets', 'exercise_id', 'exercises'],
    ['subtasks', 'task_id', 'tasks'],
    ['task_tags', 'task_id', 'tasks'],
    ['task_tags', 'tag_id', 'tags'],
    ['note_tags', 'note_id', 'notes'],
    ['note_tags', 'tag_id', 'tags'],
    ['goals', 'habit_id', 'habits'],
    ['tasks', 'project_id', 'projects'],
    ['template_sets', 'template_id', 'workout_templates'],
    ['template_sets', 'exercise_id', 'exercises'],
    ['transactions', 'category_id', 'finance_categories'],
    ['transactions', 'bill_id', 'recurring_bills'],
    ['recurring_bills', 'category_id', 'finance_categories'],
    ['medication_logs', 'medication_id', 'medications'],
    ['practice_sessions', 'skill_id', 'skills'],
    ['meter_readings', 'meter_id', 'meters'],
  ];
  for (const [table, column, parent] of references) {
    const parentIds = ids(data[parent]);
    // Puste powiązanie (NULL, np. cel bez nawyku) jest w porządku.
    if (data[table]?.some((row) => row[column] !== null && row[column] !== undefined && !parentIds.has(row[column]))) {
      throw new BackupError(`Kopia jest uszkodzona (${table} wskazuje na nieistniejące ${parent}).`);
    }
  }
}

/** „12 zadań · 5 nawyków · 3 notatki · 20 wpisów · 8 treningów” */
export function backupSummary({ data }: Backup) {
  const parts = [
    plural(data.tasks?.length ?? 0, ['zadanie', 'zadania', 'zadań']),
    plural(data.habits?.length ?? 0, ['nawyk', 'nawyki', 'nawyków']),
    plural(data.notes?.length ?? 0, ['notatka', 'notatki', 'notatek']),
    plural(data.journal_entries?.length ?? 0, ['wpis w dzienniku', 'wpisy w dzienniku', 'wpisów w dzienniku']),
    plural(data.workouts?.length ?? 0, ['trening', 'treningi', 'treningów']),
    plural(data.measurements?.length ?? 0, ['pomiar', 'pomiary', 'pomiarów']),
    plural(data.transactions?.length ?? 0, ['wpis w finansach', 'wpisy w finansach', 'wpisów w finansach']),
  ];
  return parts.join(' · ');
}

/**
 * Tabele wskazujące na rodzica bez ON DELETE CASCADE. Gdy kopia podmienia rodzica, a nie ma w niej
 * tych tabel (starsza kopia), trzeba je wyczyścić — inaczej klucze obce zablokują usuwanie.
 */
const NON_CASCADING_CHILDREN: Partial<Record<BackupTable, BackupTable[]>> = {
  exercises: ['workout_sets', 'template_sets'],
};

/** Zastępuje dane tabel obecnych w kopii (w jednej transakcji — przy błędzie nic się nie zmienia). */
export async function restoreBackup(db: SQLiteDatabase, backup: Backup) {
  const tables = BACKUP_TABLES.filter((table) => backup.data[table] !== undefined);
  const toClear = new Set<BackupTable>(tables.flatMap((table) => [table, ...(NON_CASCADING_CHILDREN[table] ?? [])]));

  await db.withTransactionAsync(async () => {
    // Najpierw dzieci, potem rodzice — inaczej klucze obce zablokują usuwanie.
    for (const table of [...BACKUP_TABLES].reverse()) {
      if (toClear.has(table)) await db.runAsync(`DELETE FROM ${table}`);
    }

    // Ustawienia z kopii (tylko gdy kopia je zawiera — starsze nie ruszają obecnych).
    if (backup.settings) {
      for (const key of BACKUP_SETTINGS) {
        await db.runAsync('DELETE FROM settings WHERE key = ?', key);
        const value = backup.settings[key];
        if (value !== undefined) await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', key, value);
      }
    }

    for (const table of tables) {
      const columns = new Set(
        (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((column) => column.name),
      );
      for (const row of backup.data[table]!) {
        const keys = Object.keys(row).filter((key) => columns.has(key));
        if (keys.length === 0) continue;
        await db.runAsync(
          `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map((key) => row[key]),
        );
      }
    }
  });
}
