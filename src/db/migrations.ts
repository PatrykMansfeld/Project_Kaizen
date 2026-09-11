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

  // v3 — nawyki w wybrane dni tygodnia, zadania cykliczne
  `
  -- Bit 0 = poniedziałek … bit 6 = niedziela; 127 = codziennie.
  ALTER TABLE habits ADD COLUMN days_mask INTEGER NOT NULL DEFAULT 127 CHECK (days_mask BETWEEN 1 AND 127);

  ALTER TABLE tasks ADD COLUMN repeat TEXT CHECK (repeat IN ('daily', 'weekdays', 'weekly', 'monthly'));
  -- Zrobiona kopia zadania cyklicznego wskazuje na zadanie, z którego powstała (bez klucza obcego —
  -- historia zostaje po usunięciu zadania).
  ALTER TABLE tasks ADD COLUMN recurring_parent_id INTEGER;
  `,

  // v4 — cele liczbowe w nawykach, podzadania, tagi, pomiary ciała
  `
  -- Przebudowa habits: cel może być duży (np. 10 000 kroków), dochodzi jednostka.
  -- SQLite nie zmienia CHECK w istniejącej tabeli, więc: nowa tabela → kopia → podmiana.
  CREATE TABLE habits_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    target_per_day INTEGER NOT NULL DEFAULT 1 CHECK (target_per_day BETWEEN 1 AND 1000000),
    -- NULL = licznik (1–5×), inaczej jednostka ilości, np. 'kroków'.
    unit TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    reminder_time TEXT,
    days_mask INTEGER NOT NULL DEFAULT 127 CHECK (days_mask BETWEEN 1 AND 127)
  );
  INSERT INTO habits_new (id, name, icon, color, target_per_day, sort_order, archived, created_at, reminder_time, days_mask)
    SELECT id, name, icon, color, target_per_day, sort_order, archived, created_at, reminder_time, days_mask FROM habits;
  DROP TABLE habits;
  ALTER TABLE habits_new RENAME TO habits;

  CREATE TABLE subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL
  );
  CREATE INDEX subtasks_task ON subtasks (task_id);

  CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    -- Klucz z palety theme/palette.ts.
    color TEXT NOT NULL
  );
  CREATE TABLE task_tags (
    task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
  );
  CREATE INDEX task_tags_tag ON task_tags (tag_id);
  CREATE TABLE note_tags (
    note_id INTEGER NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
  );
  CREATE INDEX note_tags_tag ON note_tags (tag_id);

  CREATE TABLE measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('weight', 'body_fat', 'waist', 'chest', 'hips', 'arm', 'thigh')),
    date TEXT NOT NULL,
    value REAL NOT NULL CHECK (value > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX measurements_type_date ON measurements (type, date);
  `,

  // v5 — godzina zadania (przypomnienie), cele długoterminowe, szablony treningów
  `
  -- 'HH:MM' albo NULL; ma sens tylko razem z due_date.
  ALTER TABLE tasks ADD COLUMN due_time TEXT;

  CREATE TABLE goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    -- Skąd liczymy postęp: z treningów, nawyku, pomiaru albo ręcznie.
    kind TEXT NOT NULL CHECK (kind IN ('distance', 'workouts', 'minutes', 'habit', 'measurement', 'manual')),
    workout_type TEXT,
    habit_id INTEGER REFERENCES habits (id) ON DELETE CASCADE,
    measurement_type TEXT,
    -- Dla pomiaru: wartość na starcie (np. waga 82 kg przy celu 78 kg).
    start_value REAL,
    target REAL NOT NULL CHECK (target > 0),
    unit TEXT,
    -- Postęp celu ręcznego (np. przeczytane książki).
    progress REAL NOT NULL DEFAULT 0,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE workout_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE TABLE template_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates (id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises (id),
    position INTEGER NOT NULL,
    reps INTEGER CHECK (reps > 0),
    weight_kg REAL CHECK (weight_kg >= 0)
  );
  CREATE INDEX template_sets_template ON template_sets (template_id);
  `,
];

export async function migrateDb(db: SQLiteDatabase) {
  // Obie opcje nie działają wewnątrz transakcji. Klucze obce są wyłączone na czas migracji
  // (inaczej przebudowa tabeli skasowałaby powiązane wiersze) i sprawdzane ręcznie przed zatwierdzeniem.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      const broken = await db.getFirstAsync('PRAGMA foreign_key_check');
      if (broken) throw new Error(`Migracja ${next} naruszyła powiązania: ${JSON.stringify(broken)}`);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }

  // foreign_keys trzeba włączać przy każdym otwarciu bazy.
  await db.execAsync('PRAGMA foreign_keys = ON');
}
