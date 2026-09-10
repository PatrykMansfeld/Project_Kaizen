import type { SQLiteDatabase } from 'expo-sqlite';

import type { DateKey } from '@/lib/dates';

export type Priority = 0 | 1 | 2 | 3;

export type Task = {
  id: number;
  title: string;
  notes: string;
  priority: Priority;
  due_date: DateKey | null;
  completed_at: string | null;
  created_at: string;
};

export type TaskInput = Pick<Task, 'title' | 'notes' | 'priority' | 'due_date'>;

export type TaskFilter = 'open' | 'today' | 'done';

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'Brak',
  1: 'Niski',
  2: 'Średni',
  3: 'Wysoki',
};

// Otwarte: najpierw z terminem (najbliższy na górze), potem bez; w obrębie dnia wyższy priorytet wyżej.
const OPEN_ORDER = 'ORDER BY due_date IS NULL, due_date, priority DESC, id';

export const TASK_LIST_SQL: Record<TaskFilter, string> = {
  open: `SELECT * FROM tasks WHERE completed_at IS NULL ${OPEN_ORDER}`,
  // „Na dziś” obejmuje też zaległe.
  today: `SELECT * FROM tasks WHERE completed_at IS NULL AND due_date <= $today ${OPEN_ORDER}`,
  done: 'SELECT * FROM tasks WHERE completed_at IS NOT NULL ORDER BY completed_at DESC',
};

export const TASK_COUNTS_SQL = `
  SELECT
    COALESCE(SUM(completed_at IS NULL), 0) AS open,
    COALESCE(SUM(completed_at IS NULL AND due_date <= $today), 0) AS today,
    COALESCE(SUM(completed_at IS NOT NULL), 0) AS done
  FROM tasks`;

export type TaskCounts = Record<TaskFilter, number>;

export function getTask(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Task>('SELECT * FROM tasks WHERE id = ?', id);
}

export function createTask(db: SQLiteDatabase, input: TaskInput) {
  return db.runAsync(
    'INSERT INTO tasks (title, notes, priority, due_date) VALUES ($title, $notes, $priority, $due)',
    { $title: input.title, $notes: input.notes, $priority: input.priority, $due: input.due_date },
  );
}

export function updateTask(db: SQLiteDatabase, id: number, input: TaskInput) {
  return db.runAsync(
    'UPDATE tasks SET title = $title, notes = $notes, priority = $priority, due_date = $due WHERE id = $id',
    { $id: id, $title: input.title, $notes: input.notes, $priority: input.priority, $due: input.due_date },
  );
}

export function setTaskDone(db: SQLiteDatabase, id: number, done: boolean) {
  return db.runAsync(
    `UPDATE tasks SET completed_at = ${done ? "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')" : 'NULL'} WHERE id = ?`,
    id,
  );
}

export function deleteTask(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}
