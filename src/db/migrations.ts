import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Kolejne wersje schematu. Numer wersji bazy (PRAGMA user_version) = liczba zastosowanych migracji.
 *
 * Nie edytuj migracji, która mogła już trafić na telefon — zmiany dopisuj jako nową pozycję na końcu.
 * Nie używaj tabel WITHOUT ROWID: nie wysyłają zdarzeń zmian, na których opiera się `useQuery`.
 *
 * Daty dni to 'YYYY-MM-DD' (patrz lib/dates.ts), znaczniki czasu to ISO 8601 w UTC.
 */
const MIGRATIONS: string[] = [
  // v1 — schemat wszystkich modułów
  `
  CREATE TABLE workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('walk', 'run', 'bike', 'gym', 'swim', 'other')),
    date TEXT NOT NULL,
    duration_min INTEGER CHECK (duration_min > 0),
    distance_km REAL CHECK (distance_km > 0),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX workouts_date ON workouts (date);

  CREATE TABLE habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    target_per_day INTEGER NOT NULL DEFAULT 1 CHECK (target_per_day BETWEEN 1 AND 5),
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE habit_logs (
    habit_id INTEGER NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    count INTEGER NOT NULL CHECK (count >= 0),
    PRIMARY KEY (habit_id, date)
  );
  CREATE INDEX habit_logs_date ON habit_logs (date);

  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
    due_date TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX tasks_due_date ON tasks (due_date);

  CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE journal_entries (
    date TEXT PRIMARY KEY,
    mood INTEGER CHECK (mood BETWEEN 1 AND 5),
    body TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  `,

  // v2 — ćwiczenia na siłowni, przypomnienia o nawykach, ustawienia
  `
  CREATE TABLE exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  INSERT INTO exercises (name) VALUES
    ('Przysiad ze sztangą'), ('Martwy ciąg'), ('Wyciskanie sztangi na ławce'),
    ('Wyciskanie hantli na skosie'), ('Wyciskanie żołnierskie'), ('Wiosłowanie sztangą'),
    ('Podciąganie na drążku'), ('Ściąganie drążka wyciągu'), ('Pompki'), ('Pompki na poręczach'),
    ('Uginanie ramion ze sztangą'), ('Prostowanie ramion na wyciągu'), ('Wznosy bokiem z hantlami'),
    ('Wykroki'), ('Wypychanie na suwnicy'), ('Hip thrust'), ('Uginanie nóg na maszynie'),
    ('Wspięcia na palce'), ('Plank'), ('Brzuszki');

  -- Serie w treningu; kolejność ćwiczeń wynika z najniższej pozycji ich serii.
  CREATE TABLE workout_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises (id),
    position INTEGER NOT NULL,
    reps INTEGER CHECK (reps > 0),
    weight_kg REAL CHECK (weight_kg >= 0)
  );
  CREATE INDEX workout_sets_workout ON workout_sets (workout_id);
  CREATE INDEX workout_sets_exercise ON workout_sets (exercise_id);

  -- 'HH:MM' albo NULL (bez przypomnienia).
  ALTER TABLE habits ADD COLUMN reminder_time TEXT;

  -- Ustawienia aplikacji (nie trafiają do kopii zapasowej).
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export async function migrateDb(db: SQLiteDatabase) {
  // Obie opcje nie działają wewnątrz transakcji, a foreign_keys trzeba włączać przy każdym otwarciu.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}
