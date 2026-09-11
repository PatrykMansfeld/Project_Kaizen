import type { SQLiteDatabase } from 'expo-sqlite';

export type Subtask = { id: number; task_id: number; title: string; done: 0 | 1; position: number };

export type SubtaskInput = { title: string; done: boolean };

export function getSubtasks(db: SQLiteDatabase, taskId: number) {
  return db.getAllAsync<Subtask>('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position', taskId);
}

/** Podmienia podzadania zadania. Nie otwiera własnej transakcji — wywołuj wewnątrz innej. */
export async function replaceSubtasks(db: SQLiteDatabase, taskId: number, items: SubtaskInput[]) {
  await db.runAsync('DELETE FROM subtasks WHERE task_id = ?', taskId);
  for (const [position, item] of items.entries()) {
    await db.runAsync(
      'INSERT INTO subtasks (task_id, title, done, position) VALUES (?, ?, ?, ?)',
      taskId,
      item.title,
      item.done ? 1 : 0,
      position,
    );
  }
}
