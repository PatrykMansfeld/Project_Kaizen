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

  // v6 — sen, przegląd tygodnia, projekty zadań, nawyki „X razy w tygodniu”, zdjęcia w notatkach
  `
  -- Sen przypisany do dnia pobudki.
  CREATE TABLE sleep_logs (
    date TEXT PRIMARY KEY,
    bedtime TEXT NOT NULL,
    wake_time TEXT NOT NULL,
    duration_min INTEGER NOT NULL CHECK (duration_min > 0),
    quality INTEGER CHECK (quality BETWEEN 1 AND 5),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Przegląd tygodnia, klucz = poniedziałek.
  CREATE TABLE weekly_reviews (
    week_start TEXT PRIMARY KEY,
    went_well TEXT NOT NULL DEFAULT '',
    improve TEXT NOT NULL DEFAULT '',
    priorities TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  ALTER TABLE tasks ADD COLUMN project_id INTEGER REFERENCES projects (id) ON DELETE SET NULL;
  CREATE INDEX tasks_project ON tasks (project_id);

  -- NULL = nawyk w konkretne dni (days_mask); 1–7 = tyle razy w tygodniu, w dowolne dni.
  ALTER TABLE habits ADD COLUMN weekly_target INTEGER CHECK (weekly_target BETWEEN 1 AND 7);

  -- Zdjęcia w notatkach: pliki w katalogu aplikacji, w bazie tylko ścieżki.
  CREATE TABLE note_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
    uri TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX note_images_note ON note_images (note_id);
  `,
  // v7 — wydatki i budżet
  `
  -- Kategorie wydatków i przychodów. Kwoty w groszach; monthly_budget NULL = bez limitu.
  CREATE TABLE finance_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    monthly_budget INTEGER CHECK (monthly_budget > 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  INSERT INTO finance_categories (name, icon, color, type, sort_order) VALUES
    ('Jedzenie', '🛒', 'green', 'expense', 1), ('Restauracje', '🍔', 'orange', 'expense', 2),
    ('Transport', '🚗', 'blue', 'expense', 3), ('Dom', '🏠', 'indigo', 'expense', 4),
    ('Rachunki', '💡', 'yellow', 'expense', 5), ('Zdrowie', '💊', 'red', 'expense', 6),
    ('Rozrywka', '🎬', 'purple', 'expense', 7), ('Zakupy', '🛍️', 'pink', 'expense', 8),
    ('Inne', '📦', 'teal', 'expense', 9),
    ('Wypłata', '💰', 'green', 'income', 10), ('Inne przychody', '➕', 'teal', 'income', 11);
  -- Wydatki i przychody; kwota w groszach (liczba całkowita — bez błędów zaokrągleń).
  -- Usunięcie kategorii zostawia wpisy „bez kategorii”.
  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    category_id INTEGER REFERENCES finance_categories (id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX transactions_date ON transactions (date);
  CREATE INDEX transactions_category ON transactions (category_id);
  `,
  // v8 — stałe opłaty, leki i suplementy, umiejętności, dom
  `
  -- Stałe opłaty i subskrypcje; kwota w groszach, next_due = najbliższy termin płatności.
  CREATE TABLE recurring_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    next_due TEXT NOT NULL,
    category_id INTEGER REFERENCES finance_categories (id) ON DELETE SET NULL,
    -- Ile dni przed terminem przypomnieć (NULL = bez przypomnienia).
    remind_days_before INTEGER CHECK (remind_days_before BETWEEN 0 AND 14),
    active INTEGER NOT NULL DEFAULT 1,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  -- Wydatek zapisany przyciskiem „Zapłacone” wskazuje na opłatę (historia płatności).
  ALTER TABLE transactions ADD COLUMN bill_id INTEGER REFERENCES recurring_bills (id) ON DELETE SET NULL;
  CREATE INDEX transactions_bill ON transactions (bill_id);

  CREATE TABLE medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    dose TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    -- Godziny dawek 'HH:MM' po przecinku; pusto = lek doraźny (bez harmonogramu).
    times TEXT NOT NULL DEFAULT '',
    days_mask INTEGER NOT NULL DEFAULT 127 CHECK (days_mask BETWEEN 1 AND 127),
    -- Zapas w sztukach (NULL = nie liczymy) i ile sztuk schodzi na jedną dawkę.
    stock INTEGER CHECK (stock >= 0),
    per_dose INTEGER NOT NULL DEFAULT 1 CHECK (per_dose >= 1),
    reminders INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE TABLE medication_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER NOT NULL REFERENCES medications (id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    -- Godzina z harmonogramu ('HH:MM'); dla leku doraźnego — godzina wzięcia.
    time TEXT NOT NULL,
    taken_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (medication_id, date, time)
  );
  CREATE INDEX medication_logs_date ON medication_logs (date);

  CREATE TABLE skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    goal_hours INTEGER CHECK (goal_hours > 0),
    archived INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE TABLE practice_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id INTEGER NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    minutes INTEGER NOT NULL CHECK (minutes > 0),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX practice_sessions_skill ON practice_sessions (skill_id, date);

  -- Obowiązki domowe co N dni (np. filtr co 90 dni).
  CREATE TABLE home_chores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    interval_days INTEGER NOT NULL CHECK (interval_days > 0),
    next_due TEXT NOT NULL,
    last_done TEXT,
    remind INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE TABLE warranties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    purchase_date TEXT,
    expires_on TEXT NOT NULL,
    price INTEGER CHECK (price > 0),
    store TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE TABLE meters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    icon TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE TABLE meter_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meter_id INTEGER NOT NULL REFERENCES meters (id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    value REAL NOT NULL CHECK (value >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX meter_readings_meter ON meter_readings (meter_id, date);
  `,
  `
  -- Filmy, seriale i gry: lista „do obejrzenia”, w trakcie, ukończone (z oceną 1–5).
  CREATE TABLE media_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('movie', 'series', 'game')),
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'done', 'dropped')),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    -- Gdzie: Netflix, kino, PS5…
    platform TEXT NOT NULL DEFAULT '',
    release_year INTEGER CHECK (release_year BETWEEN 1850 AND 2200),
    -- Postęp serialu: sezon i ostatni obejrzany odcinek.
    season INTEGER CHECK (season >= 1),
    episode INTEGER CHECK (episode >= 0),
    started_on TEXT,
    finished_on TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX media_items_status ON media_items (status, finished_on);

  CREATE TABLE trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    destination TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    -- Budżet wyjazdu w groszach.
    budget INTEGER CHECK (budget > 0),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (end_date >= start_date)
  );
  -- Lista pakowania (kind = 'pack', z kategorią) i plan wyjazdu (kind = 'plan', dzień i godzina opcjonalne).
  CREATE TABLE trip_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('pack', 'plan')),
    text TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    done INTEGER NOT NULL DEFAULT 0,
    date TEXT,
    time TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX trip_items_trip ON trip_items (trip_id, kind);
  -- Zdjęcia jak w notatkach: plik w katalogu aplikacji, w bazie ścieżka.
  CREATE TABLE trip_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    uri TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX trip_photos_trip ON trip_photos (trip_id, position);
  -- Wydatek z wyjazdu wskazuje na podróż (zostaje w Wydatkach, gdy podróż zniknie).
  ALTER TABLE transactions ADD COLUMN trip_id INTEGER REFERENCES trips (id) ON DELETE SET NULL;
  CREATE INDEX transactions_trip ON transactions (trip_id);
  `,
  `
  -- Kultura: do filmów, seriali i gier dochodzą książki, manga i anime (CHECK wymaga przebudowy tabeli),
  -- autor (książki, manga) i łączna liczba stron. Postęp: season/episode to sezon i odcinek (serial, anime),
  -- tom i rozdział (manga) albo — w episode — bieżąca strona książki.
  CREATE TABLE media_items_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('movie', 'series', 'anime', 'book', 'manga', 'game')),
    title TEXT NOT NULL,
    creator TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'done', 'dropped')),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    platform TEXT NOT NULL DEFAULT '',
    release_year INTEGER CHECK (release_year BETWEEN 1000 AND 2200),
    season INTEGER CHECK (season >= 1),
    episode INTEGER CHECK (episode >= 0),
    total INTEGER CHECK (total > 0),
    started_on TEXT,
    finished_on TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  INSERT INTO media_items_new (id, kind, title, status, rating, platform, release_year, season, episode, started_on, finished_on, note, created_at)
    SELECT id, kind, title, status, rating, platform, release_year, season, episode, started_on, finished_on, note, created_at
    FROM media_items;
  DROP TABLE media_items;
  ALTER TABLE media_items_new RENAME TO media_items;
  CREATE INDEX media_items_status ON media_items (status, finished_on);
  `,
  `
  -- Postęp (XP): cecha, którą rozwija nawyk (ciało, umysł, porządek, duch).
  ALTER TABLE habits ADD COLUMN attribute TEXT NOT NULL DEFAULT 'spirit' CHECK (attribute IN ('body', 'mind', 'order', 'spirit'));
  -- Wstępny przydział po ikonie (jak guessAttribute w features/progress/xp.ts); użytkownik może go zmienić.
  UPDATE habits SET attribute = CASE
    WHEN icon IN ('💧', '🏃', '🚶', '🚴', '🏊', '💪', '😴', '🛏️', '🦷', '🚿', '💊', '🍎', '🥗', '🥛', '🚭', '👟', '🥤', '🧴') THEN 'body'
    WHEN icon IN ('📚', '🧠', '💻', '🎸', '🎨', '📖', '✍️', '🎯') THEN 'mind'
    WHEN icon IN ('🧹', '💰', '🐶') THEN 'order'
    ELSE 'spirit'
  END;
  -- Historia obowiązków domowych (wcześniej tylko data ostatniego razu) — z niej liczą się punkty.
  CREATE TABLE chore_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chore_id INTEGER NOT NULL REFERENCES home_chores (id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX chore_logs_chore ON chore_logs (chore_id, date);
  INSERT INTO chore_logs (chore_id, date) SELECT id, last_done FROM home_chores WHERE last_done IS NOT NULL;
  -- Dni zamknięte podsumowaniem (wcześniej tylko licznik i ostatni dzień).
  CREATE TABLE daily_reviews (
    date TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  INSERT INTO daily_reviews (date) SELECT value FROM settings WHERE key = 'last_review_date';
  -- Dzień, w którym cel został osiągnięty (raz osiągnięty zostaje, jak odznaka).
  ALTER TABLE goals ADD COLUMN achieved_on TEXT;
  -- Od którego miesiąca obowiązuje budżet (liczymy tylko miesiące z budżetem, nie wstecz).
  INSERT INTO settings (key, value) SELECT 'budget_since', strftime('%Y-%m', 'now', 'localtime') FROM settings WHERE key = 'monthly_budget';
  `,
  `
  -- Okładka tytułu w Kulturze: plik w katalogu aplikacji (jak zdjęcia notatek), w bazie ścieżka.
  ALTER TABLE media_items ADD COLUMN cover_uri TEXT;
  -- Lista marzeń: rzeczy do zrobienia w życiu; spełnione mają dzień i (opcjonalnie) zdjęcie.
  CREATE TABLE dreams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other'
      CHECK (category IN ('travel', 'adventure', 'skill', 'create', 'people', 'things', 'other')),
    target_year INTEGER CHECK (target_year BETWEEN 2000 AND 2200),
    note TEXT NOT NULL DEFAULT '',
    done_on TEXT,
    photo_uri TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX dreams_done ON dreams (done_on);
  `,
  `
  -- Kultura: ocena w skali 1–10 zamiast 1–5 gwiazdek (CHECK wymaga przebudowy tabeli). Stare oceny ×2.
  CREATE TABLE media_items_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('movie', 'series', 'anime', 'book', 'manga', 'game')),
    title TEXT NOT NULL,
    creator TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'done', 'dropped')),
    rating INTEGER CHECK (rating BETWEEN 1 AND 10),
    platform TEXT NOT NULL DEFAULT '',
    release_year INTEGER CHECK (release_year BETWEEN 1000 AND 2200),
    season INTEGER CHECK (season >= 1),
    episode INTEGER CHECK (episode >= 0),
    total INTEGER CHECK (total > 0),
    started_on TEXT,
    finished_on TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    cover_uri TEXT
  );
  INSERT INTO media_items_new (id, kind, title, creator, status, rating, platform, release_year, season, episode, total,
      started_on, finished_on, note, created_at, cover_uri)
    SELECT id, kind, title, creator, status, rating * 2, platform, release_year, season, episode, total,
      started_on, finished_on, note, created_at, cover_uri
    FROM media_items;
  DROP TABLE media_items;
  ALTER TABLE media_items_new RENAME TO media_items;
  CREATE INDEX media_items_status ON media_items (status, finished_on);
  `,
  `
  -- Kultura: czas (długość filmu albo odcinka, obejrzane odcinki łącznie, czas gry), gatunki („Sci-fi, Dramat”)
  -- i ranking z porównań parami (Elo; NULL = jeszcze nieporównywany, liczy się z oceny).
  ALTER TABLE media_items ADD COLUMN length_min INTEGER CHECK (length_min > 0);
  ALTER TABLE media_items ADD COLUMN episodes_seen INTEGER CHECK (episodes_seen >= 0);
  ALTER TABLE media_items ADD COLUMN played_min INTEGER CHECK (played_min >= 0);
  ALTER TABLE media_items ADD COLUMN genres TEXT NOT NULL DEFAULT '';
  ALTER TABLE media_items ADD COLUMN elo REAL;
  ALTER TABLE media_items ADD COLUMN duels INTEGER NOT NULL DEFAULT 0;
  -- Obejrzanych odcinków nie liczyliśmy — na start przyjmujemy numer ostatniego odcinka.
  UPDATE media_items SET episodes_seen = episode WHERE kind IN ('series', 'anime') AND episode IS NOT NULL;
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
