import type { SQLiteDatabase } from 'expo-sqlite';

import type { IconName } from '@/components/icon';
import type { TransactionType } from '@/db/finance';
import type { MediaKind, MediaStatus } from '@/db/media';
import { WORKOUT_TYPES, type WorkoutType } from '@/features/activity/workout-types';
import { formatSignedMoney } from '@/features/finance/money';
import { MEDIA_KINDS } from '@/features/media/media';
import { notePreview, stripMarkdown } from '@/features/notes/markdown';
import type { DateKey } from '@/lib/dates';
import { matchesSearch } from '@/lib/search';
import type { ThemeColors } from '@/theme/theme';

export type SearchKind = 'task' | 'note' | 'journal' | 'habit' | 'workout' | 'transaction' | 'trip' | 'media' | 'dream';

export type SearchResult = {
  key: string;
  kind: SearchKind;
  title: string;
  /** Tekst, z którego pokazujemy fragment z trafieniem (np. treść notatki). */
  body: string;
  date: DateKey | null;
  /** Dokąd prowadzi stuknięcie. */
  target:
    | {
        pathname:
          | '/zadanie/[id]'
          | '/notatka/[id]'
          | '/nawyk/[id]'
          | '/trening/[id]'
          | '/finanse/transakcja/[id]'
          | '/podroz/[id]'
          | '/tytul/[id]'
          | '/marzenie/[id]';
        params: { id: string };
      }
    | {
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
  transaction: { label: 'Wydatki', icon: 'payments', color: 'finance' },
  trip: { label: 'Podróże', icon: 'flight', color: 'tasks' },
  media: { label: 'Kultura', icon: 'theater_comedy', color: 'journal' },
  dream: { label: 'Marzenia', icon: 'auto_awesome', color: 'journal' },
};

const LIMIT_PER_KIND = 20;

/**
 * Szuka we wszystkich modułach naraz. Dane jednej osoby to najwyżej kilka tysięcy wierszy,
 * więc filtrujemy w JS — dzięki temu działa bez polskich znaków i bez względu na wielkość liter.
 * `query` musi być już znormalizowane (normalizeForSearch).
 */
export async function searchEverything(db: SQLiteDatabase, query: string): Promise<SearchResult[]> {
  const [tasks, subtasks, notes, journal, habits, workouts, transactions, trips, tripItems, media, dreams] = await Promise.all([
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
    db.getAllAsync<{ id: number; type: TransactionType; amount: number; date: DateKey; note: string; category: string | null; icon: string | null }>(
      `SELECT t.id, t.type, t.amount, t.date, t.note, c.name AS category, c.icon
       FROM transactions t LEFT JOIN finance_categories c ON c.id = t.category_id
       ORDER BY t.date DESC, t.id DESC`,
    ),
    db.getAllAsync<{ id: number; name: string; icon: string; destination: string; note: string; start_date: DateKey }>(
      'SELECT id, name, icon, destination, note, start_date FROM trips ORDER BY start_date DESC',
    ),
    db.getAllAsync<{ trip_id: number; text: string }>("SELECT trip_id, text FROM trip_items WHERE kind = 'plan'"),
    db.getAllAsync<{
      id: number;
      kind: MediaKind;
      title: string;
      creator: string;
      status: MediaStatus;
      platform: string;
      genres: string;
      note: string;
      finished_on: DateKey | null;
    }>(
      'SELECT id, kind, title, creator, status, platform, genres, note, finished_on FROM media_items ORDER BY finished_on DESC, id DESC',
    ),
    db.getAllAsync<{ id: number; title: string; icon: string; note: string; done_on: DateKey | null }>(
      'SELECT id, title, icon, note, done_on FROM dreams ORDER BY done_on IS NOT NULL, id DESC',
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
        // Bez znaczników formatowania (#, **, - [ ]) — w wynikach liczy się sam tekst.
        title: notePreview(note).headline,
        body: stripMarkdown(note.body),
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

  push(
    transactions
      .filter((transaction) => matchesSearch(`${transaction.category ?? ''}\n${transaction.note}`, query))
      .map((transaction) => ({
        key: `transaction:${transaction.id}`,
        kind: 'transaction' as const,
        title: `${transaction.icon ?? '📦'} ${transaction.category ?? 'Bez kategorii'} · ${formatSignedMoney(transaction.amount, transaction.type)}`,
        body: transaction.note,
        date: transaction.date,
        target: { pathname: '/finanse/transakcja/[id]' as const, params: { id: String(transaction.id) } },
      })),
  );

  // Podróż pasuje też po punkcie planu („Koloseum”).
  const planByTrip = new Map<number, string[]>();
  for (const item of tripItems) {
    if (!planByTrip.has(item.trip_id)) planByTrip.set(item.trip_id, []);
    planByTrip.get(item.trip_id)!.push(item.text);
  }
  push(
    trips
      .map((trip) => {
        const matchedPlan = planByTrip.get(trip.id)?.find((text) => matchesSearch(text, query));
        const own = `${trip.name}\n${trip.destination}\n${trip.note}`;
        if (!matchesSearch(own, query) && !matchedPlan) return null;
        return {
          key: `trip:${trip.id}`,
          kind: 'trip' as const,
          title: `${trip.icon} ${trip.name}`,
          body: matchesSearch(own, query) ? [trip.destination, trip.note].filter(Boolean).join('\n') : (matchedPlan ?? ''),
          date: trip.start_date,
          target: { pathname: '/podroz/[id]' as const, params: { id: String(trip.id) } },
        };
      })
      .filter((result) => result !== null),
  );

  push(
    media
      .filter((item) => matchesSearch(`${item.title}\n${item.creator}\n${item.platform}\n${item.genres}\n${item.note}`, query))
      .map((item) => ({
        key: `media:${item.id}`,
        kind: 'media' as const,
        title: `${MEDIA_KINDS[item.kind].emoji} ${item.title}`,
        body: item.note || [item.creator, MEDIA_KINDS[item.kind].statuses[item.status], item.platform].filter(Boolean).join(' · '),
        date: item.finished_on,
        target: { pathname: '/tytul/[id]' as const, params: { id: String(item.id) } },
      })),
  );

  push(
    dreams
      .filter((dream) => matchesSearch(`${dream.title}\n${dream.note}`, query))
      .map((dream) => ({
        key: `dream:${dream.id}`,
        kind: 'dream' as const,
        title: `${dream.icon} ${dream.title}`,
        body: dream.note || (dream.done_on ? 'Spełnione' : 'Przed tobą'),
        date: dream.done_on,
        target: { pathname: '/marzenie/[id]' as const, params: { id: String(dream.id) } },
      })),
  );

  return results;
}
