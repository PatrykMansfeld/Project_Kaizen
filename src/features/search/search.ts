import type { SQLiteDatabase } from 'expo-sqlite';

import type { IconName } from '@/components/icon';
import { WORKOUT_TYPES, type WorkoutType } from '@/features/activity/workout-types';
import type { DateKey } from '@/lib/dates';
import { matchesSearch } from '@/lib/search';
import type { ThemeColors } from '@/theme/theme';

export type SearchKind = 'task' | 'note' | 'journal' | 'habit' | 'workout';

export type SearchResult = {
  key: string;
  kind: SearchKind;
  title: string;
  /** Tekst, z którego pokazujemy fragment z trafieniem (np. treść notatki). */
  body: string;
  date: DateKey | null;
  /** Dokąd prowadzi stuknięcie. */
  target: { pathname: '/zadanie/[id]' | '/notatka/[id]' | '/nawyk/[id]' | '/trening/[id]'; params: { id: string } } | {
    pathname: '/dziennik/[date]';
    params: { date: string };
  };
};

export const SEARCH_KINDS: Record<SearchKind, { label: string; icon: IconName; color: keyof ThemeColors }> = {
  task: { label: 'Zadania', icon: 'checklist', color: 'tasks' },
  note: { label: 'Notatki', icon: 'sticky_note_2', color: 'notes' },
  journal: { label: 'Dziennik', icon: 'auto_stories', color: 'journal' },
  habit: { label: 'Nawyki', icon: 'check_circle', color: 'habits' },
  workout: { label: 'Treningi', icon: 'directions_run', color: 'activity' },
};

const LIMIT_PER_KIND = 20;

/**
 * Szuka we wszystkich modułach naraz. Dane jednej osoby to najwyżej kilka tysięcy wierszy,
 * więc filtrujemy w JS — dzięki temu działa bez polskich znaków i bez względu na wielkość liter.
 * `query` musi być już znormalizowane (normalizeForSearch).
 */
export async function searchEverything(db: SQLiteDatabase, query: string): Promise<SearchResult[]> {
  const [tasks, subtasks, notes, journal, habits, workouts] = await Promise.all([
    db.getAllAsync<{ id: number; title: string; notes: string; due_date: DateKey | null; completed_at: string | null }>(
      'SELECT id, title, notes, due_date, completed_at FROM tasks ORDER BY completed_at IS NOT NULL, due_date IS NULL, due_date, id DESC',
    ),
    db.getAllAsync<{ task_id: number; title: string }>('SELECT task_id, title FROM subtasks'),
    db.getAllAsync<{ id: number; title: string; body: string; updated_at: string }>(
      'SELECT id, title, body, updated_at FROM notes ORDER BY updated_at DESC',
    ),
    db.getAllAsync<{ date: DateKey; body: string }>(
      "SELECT date, body FROM journal_entries WHERE body != '' ORDER BY date DESC",
    ),
    db.getAllAsync<{ id: number; name: string; icon: string }>('SELECT id, name, icon FROM habits ORDER BY archived, sort_order'),
    db.getAllAsync<{ id: number; type: WorkoutType; date: DateKey; note: string }>(
      'SELECT id, type, date, note FROM workouts ORDER BY date DESC, id DESC',
    ),
  ]);

  const results: SearchResult[] = [];
  const push = (items: SearchResult[]) => results.push(...items.slice(0, LIMIT_PER_KIND));

  // Zadanie pasuje też wtedy, gdy pasuje któreś z jego podzadań.
  const subtasksByTask = new Map<number, string[]>();
  for (const subtask of subtasks) {
    if (!subtasksByTask.has(subtask.task_id)) subtasksByTask.set(subtask.task_id, []);
    subtasksByTask.get(subtask.task_id)!.push(subtask.title);
  }
  push(
    tasks
      .map((task) => {
        const matchedSubtask = subtasksByTask.get(task.id)?.find((title) => matchesSearch(title, query));
        if (!matchesSearch(task.title, query) && !matchesSearch(task.notes, query) && !matchedSubtask) return null;
        return {
          key: `task:${task.id}`,
          kind: 'task' as const,
          title: task.title,
          body: matchesSearch(task.notes, query) ? task.notes : (matchedSubtask ?? task.notes),
          date: task.due_date,
          target: { pathname: '/zadanie/[id]' as const, params: { id: String(task.id) } },
        };
      })
      .filter((result) => result !== null),
  );

  push(
    notes
      .filter((note) => matchesSearch(`${note.title}\n${note.body}`, query))
      .map((note) => ({
        key: `note:${note.id}`,
        kind: 'note' as const,
        title: note.title.trim() || note.body.trim().split('\n')[0] || 'Bez tytułu',
        body: note.body,
        date: null,
        target: { pathname: '/notatka/[id]' as const, params: { id: String(note.id) } },
      })),
  );

  push(
    journal
      .filter((entry) => matchesSearch(entry.body, query))
      .map((entry) => ({
        key: `journal:${entry.date}`,
        kind: 'journal' as const,
        title: 'Wpis w dzienniku',
        body: entry.body,
        date: entry.date,
        target: { pathname: '/dziennik/[date]' as const, params: { date: entry.date } },
      })),
  );

  push(
    habits
      .filter((habit) => matchesSearch(habit.name, query))
      .map((habit) => ({
        key: `habit:${habit.id}`,
        kind: 'habit' as const,
        title: `${habit.icon} ${habit.name}`,
        body: '',
        date: null,
        target: { pathname: '/nawyk/[id]' as const, params: { id: String(habit.id) } },
      })),
  );

  push(
    workouts
      .filter((workout) => matchesSearch(`${WORKOUT_TYPES[workout.type].label}\n${workout.note}`, query))
      .map((workout) => ({
        key: `workout:${workout.id}`,
        kind: 'workout' as const,
        title: WORKOUT_TYPES[workout.type].label,
        body: workout.note,
        date: workout.date,
        target: { pathname: '/trening/[id]' as const, params: { id: String(workout.id) } },
      })),
  );

  return results;
}
