import type { SQLiteDatabase } from 'expo-sqlite';

import { plural } from '@/lib/format';

/**
 * Kopia zapasowa to JSON ze wszystkimi wierszami tabel. Import przepisuje tylko kolumny, które istnieją
 * w obecnej bazie, więc stare kopie da się wczytać po zmianach schematu (nowe kolumny dostaną domyślne wartości).
 */

/** Tabele w kopii, w kolejności wstawiania (rodzice przed dziećmi). Ustawienia nie trafiają do kopii. */
export const BACKUP_TABLES = [
  'exercises',
  'workouts',
  'workout_sets',
  'habits',
  'habit_logs',
  'tasks',
  'notes',
  'journal_entries',
] as const;

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
};

/** Błąd z komunikatem do pokazania użytkownikowi. */
export class BackupError extends Error {}

export async function createBackup(db: SQLiteDatabase): Promise<Backup> {
  const data: Backup['data'] = {};
  for (const table of BACKUP_TABLES) {
    data[table] = await db.getAllAsync<Row>(`SELECT * FROM ${table}`);
  }
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return {
    app: 'kaizen',
    format: FORMAT,
    schemaVersion: version?.user_version ?? 0,
    exportedAt: new Date().toISOString(),
    data,
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
  ];
  for (const [table, column, parent] of references) {
    const parentIds = ids(data[parent]);
    if (data[table]?.some((row) => !parentIds.has(row[column]))) {
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
  ];
  return parts.join(' · ');
}

/** Zastępuje dane tabel obecnych w kopii (w jednej transakcji — przy błędzie nic się nie zmienia). */
export async function restoreBackup(db: SQLiteDatabase, backup: Backup) {
  const tables = BACKUP_TABLES.filter((table) => backup.data[table] !== undefined);

  await db.withTransactionAsync(async () => {
    // Najpierw dzieci, potem rodzice — inaczej klucze obce zablokują usuwanie.
    for (const table of [...tables].reverse()) {
      await db.runAsync(`DELETE FROM ${table}`);
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
