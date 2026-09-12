import type { SQLiteDatabase } from 'expo-sqlite';

import { NOW_SQL } from '@/db/sql';
import type { Table } from '@/db/use-query';

import { addDays, addMonths, weekdayIndex, type DateKey } from '@/lib/dates';

export type Priority = 0 | 1 | 2 | 3;

export type Repeat = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export type Task = {
  id: number;
  title: string;
  notes: string;
  priority: Priority;
  due_date: DateKey | null;
  /** 'HH:MM' — godzina terminu i przypomnienia (tylko z due_date). */
  due_time: string | null;
  completed_at: string | null;
  created_at: string;
  /** Tylko zadania z terminem mogą się powtarzać. */
  repeat: Repeat | null;
  /** Zrobiona kopia zadania cyklicznego → id zadania, z którego powstała. */
  recurring_parent_id: number | null;
  project_id: number | null;
  /** Tylko w zapytaniach z TASK_COLUMNS. */
  subtask_count?: number;
  subtask_done?: number;
  /** Id tagów po przecinku ('1,4') albo null. */
  tag_ids?: string | null;
  project_name?: string | null;
};

/** Kolumny zadania razem z postępem podzadań i tagami — do list. */
export const TASK_COLUMNS = `tasks.*,
  (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = tasks.id) AS subtask_count,
  (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = tasks.id AND s.done = 1) AS subtask_done,
  (SELECT GROUP_CONCAT(tt.tag_id) FROM task_tags tt WHERE tt.task_id = tasks.id) AS tag_ids,
  (SELECT p.name FROM projects p WHERE p.id = tasks.project_id) AS project_name`;

/** Tabele, od których zależą listy zadań (do useQuery). */
export const TASK_TABLES: readonly Table[] = ['tasks', 'subtasks', 'task_tags', 'tags', 'projects'];

// $tag = null → wszystkie zadania; inaczej tylko z tym tagiem.
const TAG_FILTER = 'AND ($tag IS NULL OR EXISTS (SELECT 1 FROM task_tags f WHERE f.task_id = tasks.id AND f.tag_id = $tag))';

export type TaskInput = Pick<Task, 'title' | 'notes' | 'priority' | 'due_date' | 'due_time' | 'repeat' | 'project_id'>;

export type TaskFilter = 'open' | 'today' | 'done';

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'Brak',
  1: 'Niski',
  2: 'Średni',
  3: 'Wysoki',
};

export const REPEAT_LABELS: Record<Repeat, string> = {
  daily: 'Codziennie',
  weekdays: 'Dni robocze',
  weekly: 'Co tydzień',
  monthly: 'Co miesiąc',
};

// Otwarte: najpierw z terminem (najbliższy na górze), potem bez; w obrębie dnia wyższy priorytet wyżej.
const OPEN_ORDER = 'ORDER BY due_date IS NULL, due_date, due_time IS NULL, due_time, priority DESC, id';

export const TASK_LIST_SQL: Record<TaskFilter, string> = {
  open: `SELECT ${TASK_COLUMNS} FROM tasks WHERE completed_at IS NULL ${TAG_FILTER} ${OPEN_ORDER}`,
  // „Na dziś” obejmuje też zaległe.
  today: `SELECT ${TASK_COLUMNS} FROM tasks WHERE completed_at IS NULL AND due_date <= $today ${TAG_FILTER} ${OPEN_ORDER}`,
  done: `SELECT ${TASK_COLUMNS} FROM tasks WHERE completed_at IS NOT NULL ${TAG_FILTER} ORDER BY completed_at DESC`,
};

export const TASK_COUNTS_SQL = `
  SELECT
    COALESCE(SUM(completed_at IS NULL), 0) AS open,
    COALESCE(SUM(completed_at IS NULL AND due_date <= $today), 0) AS today,
    COALESCE(SUM(completed_at IS NOT NULL), 0) AS done
  FROM tasks WHERE 1 ${TAG_FILTER}`;

export type TaskCounts = Record<TaskFilter, number>;

export function getTask(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Task>('SELECT * FROM tasks WHERE id = ?', id);
}

function toParams(input: TaskInput) {
  return {
    $title: input.title,
    $notes: input.notes,
    $priority: input.priority,
    $due: input.due_date,
    // Godzina i powtarzanie bez terminu nie mają sensu.
    $time: input.due_date ? (input.due_time ?? null) : null,
    $repeat: input.due_date ? input.repeat : null,
    $project: input.project_id ?? null,
  };
}

export function createTask(db: SQLiteDatabase, input: TaskInput) {
  return db.runAsync(
    `INSERT INTO tasks (title, notes, priority, due_date, due_time, repeat, project_id)
     VALUES ($title, $notes, $priority, $due, $time, $repeat, $project)`,
    toParams(input),
  );
}

/** Szybkie zadanie z samym tytułem i terminem (plan na jutro, priorytety tygodnia). */
export function createQuickTask(db: SQLiteDatabase, title: string, dueDate: DateKey, priority: Priority = 0) {
  return createTask(db, { title, notes: '', priority, due_date: dueDate, due_time: null, repeat: null, project_id: null });
}

export function updateTask(db: SQLiteDatabase, id: number, input: TaskInput) {
  return db.runAsync(
    `UPDATE tasks SET title = $title, notes = $notes, priority = $priority, due_date = $due, due_time = $time,
       repeat = $repeat, project_id = $project
     WHERE id = $id`,
    { ...toParams(input), $id: id },
  );
}

function setTaskDone(db: SQLiteDatabase, id: number, done: boolean) {
  return db.runAsync(
    `UPDATE tasks SET completed_at = ${done ? NOW_SQL : 'NULL'} WHERE id = ?`,
    id,
  );
}

function step(day: DateKey, repeat: Repeat): DateKey {
  switch (repeat) {
    case 'daily':
      return addDays(day, 1);
    case 'weekdays': {
      let next = addDays(day, 1);
      while (weekdayIndex(next) > 4) next = addDays(next, 1);
      return next;
    }
    case 'weekly':
      return addDays(day, 7);
    case 'monthly':
      return addMonths(day, 1);
  }
}

/**
 * Kolejny termin po `due`, ale nie wcześniejszy niż jutro — zaległe zadanie cotygodniowe
 * odhaczone w środę przeskakuje na najbliższy właściwy dzień, a nie na dzień, który już minął.
 */
export function nextDueDate(due: DateKey, repeat: Repeat, today: DateKey): DateKey {
  let next = step(due, repeat);
  while (next <= today) next = step(next, repeat);
  return next;
}

/**
 * Odhaczenie / odznaczenie zadania.
 * Zadanie cykliczne po odhaczeniu przeskakuje na kolejny termin, a w historii zostaje zrobiona kopia.
 * Odznaczenie ostatniej takiej kopii cofa zadanie na jej termin.
 */
export async function toggleTask(db: SQLiteDatabase, task: Task, today: DateKey) {
  if (task.completed_at === null) {
    if (!task.repeat || !task.due_date) {
      await setTaskDone(db, task.id, true);
      return;
    }
    const { repeat, due_date: due } = task;
    await db.withTransactionAsync(async () => {
      const { lastInsertRowId: copyId } = await db.runAsync(
        `INSERT INTO tasks (title, notes, priority, due_date, due_time, project_id, completed_at, recurring_parent_id)
         VALUES (?, ?, ?, ?, ?, ?, ${NOW_SQL}, ?)`,
        task.title,
        task.notes,
        task.priority,
        due,
        task.due_time ?? null,
        task.project_id ?? null,
        task.id,
      );
      // Zrobiona kopia zabiera stan podzadań i tagi; zadanie na kolejny termin ma podzadania od zera.
      await db.runAsync(
        `INSERT INTO subtasks (task_id, title, done, position) SELECT ?, title, done, position FROM subtasks WHERE task_id = ?`,
        copyId,
        task.id,
      );
      await db.runAsync('UPDATE subtasks SET done = 0 WHERE task_id = ?', task.id);
      await db.runAsync('INSERT INTO task_tags (task_id, tag_id) SELECT ?, tag_id FROM task_tags WHERE task_id = ?', copyId, task.id);
      await db.runAsync('UPDATE tasks SET due_date = ? WHERE id = ?', nextDueDate(due, repeat, today), task.id);
    });
    return;
  }

  if (task.recurring_parent_id !== null && task.due_date) {
    const parent = await getTask(db, task.recurring_parent_id);
    const latest = await db.getFirstAsync<{ id: number }>(
      'SELECT MAX(id) AS id FROM tasks WHERE recurring_parent_id = ?',
      task.recurring_parent_id,
    );
    if (parent && parent.completed_at === null && parent.repeat && latest?.id === task.id) {
      const due = task.due_date;
      await db.withTransactionAsync(async () => {
        await db.runAsync('UPDATE tasks SET due_date = ? WHERE id = ?', due, parent.id);
        // Stan podzadań wraca do zadania razem z terminem.
        await db.runAsync('DELETE FROM subtasks WHERE task_id = ?', parent.id);
        await db.runAsync('UPDATE subtasks SET task_id = ? WHERE task_id = ?', parent.id, task.id);
        await db.runAsync('DELETE FROM tasks WHERE id = ?', task.id);
      });
      return;
    }
  }
  await setTaskDone(db, task.id, false);
}

/**
 * Podsumowanie dnia: niezrobione zadania z terminem do `date` przechodzą na następny dzień.
 * Cykliczne zostają — mają własny rytm. Zwraca liczbę przeniesionych.
 */
export async function moveOpenTasksToNextDay(db: SQLiteDatabase, date: DateKey) {
  const result = await db.runAsync(
    'UPDATE tasks SET due_date = ? WHERE completed_at IS NULL AND repeat IS NULL AND due_date <= ?',
    addDays(date, 1),
    date,
  );
  return result.changes;
}

export function deleteTask(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}
