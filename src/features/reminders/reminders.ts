import { isRunningInExpoGo } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getSetting } from '@/db/settings';
import { formatAmount } from '@/features/habits/amount';
import { isScheduled } from '@/features/habits/streak';
import { addDays, fromDateKey, todayKey, type DateKey } from '@/lib/dates';

/**
 * Lokalne powiadomienia: przypomnienia o nawykach, o zadaniach z godziną i o wieczornym podsumowaniu.
 * Planujemy je na konkretne dni (nie powtarzalnym wyzwalaczem), dzięki czemu można pominąć dzień,
 * w którym rzecz jest już zrobiona. Plan odświeża się przy zmianach w bazie i przy otwarciu aplikacji.
 */

const DAYS_AHEAD = 14;
const TASKS_DAYS_AHEAD = 60;
const MAX_TASK_REMINDERS = 60;

const CHANNELS = {
  habits: 'Przypomnienia o nawykach',
  tasks: 'Przypomnienia o zadaniach',
  review: 'Podsumowanie dnia',
} as const;
type ChannelId = keyof typeof CHANNELS;

/** Każde zaplanowane przez nas powiadomienie ma identyfikator z jednym z tych przedrostków. */
const PREFIXES = ['habit:', 'task:', 'review:'];

/**
 * W Expo Go na Androidzie sam import expo-notifications rzuca błąd (push usunięto z Expo Go w SDK 53),
 * więc tam przypomnienia są wyłączone — działają dopiero w zbudowanej aplikacji (APK / development build).
 */
export const notificationsSupported = !(Platform.OS === 'android' && isRunningInExpoGo());

let notificationsModule: typeof NotificationsModule | null | undefined;

/** expo-notifications ładujemy leniwie, żeby Expo Go w ogóle go nie importował. */
export function getNotifications() {
  if (notificationsModule === undefined) {
    if (!notificationsSupported) {
      notificationsModule = null;
    } else {
      try {
        // W trybie deweloperskim Metro potrafi połknąć błąd importu i zwrócić undefined.
        notificationsModule = (require('expo-notifications') as typeof NotificationsModule | undefined) ?? null;
      } catch (error) {
        console.warn('Powiadomienia niedostępne:', error);
        notificationsModule = null;
      }
    }
  }
  return notificationsModule;
}

async function ensureChannel(Notifications: typeof NotificationsModule, channel: ChannelId) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(channel, {
    name: CHANNELS[channel],
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function getPermissionState(): Promise<PermissionState> {
  const Notifications = getNotifications();
  if (!Notifications) return 'unavailable';
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  return granted ? 'granted' : canAskAgain ? 'undetermined' : 'denied';
}

/** Prosi o zgodę na powiadomienia (na Androidzie 13+ systemowe okienko). */
export async function requestPermission(): Promise<PermissionState> {
  const Notifications = getNotifications();
  if (!Notifications) return 'unavailable';
  // Na Androidzie 13+ okienko zgody pojawia się dopiero, gdy istnieje kanał powiadomień.
  await ensureChannel(Notifications, 'habits');
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted ? 'granted' : 'denied';
}

/** Krótki skrót treści, żeby zmiana nazwy czy celu zaplanowała powiadomienie od nowa. */
function hash(text: string) {
  let value = 5381;
  for (let i = 0; i < text.length; i++) value = (value * 33 + text.charCodeAt(i)) >>> 0;
  return value.toString(36);
}

type Planned = { id: string; at: Date; title: string; body: string; url: string; channel: ChannelId };

function atTime(day: DateKey, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const date = fromDateKey(day);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

async function planHabits(db: SQLiteDatabase, today: DateKey, now: number): Promise<Planned[]> {
  const habits = await db.getAllAsync<{
    id: number;
    name: string;
    icon: string;
    target_per_day: number;
    unit: string | null;
    reminder_time: string;
    days_mask: number;
    today_count: number;
  }>(
    `SELECT h.id, h.name, h.icon, h.target_per_day, h.unit, h.reminder_time, h.days_mask,
       COALESCE(l.count, 0) AS today_count
     FROM habits h LEFT JOIN habit_logs l ON l.habit_id = h.id AND l.date = $today
     WHERE h.archived = 0 AND h.reminder_time IS NOT NULL`,
    { $today: today },
  );
  const planned: Planned[] = [];
  for (const habit of habits) {
    const contentHash = hash(`${habit.name}|${habit.icon}|${habit.target_per_day}|${habit.unit ?? ''}`);
    for (let offset = 0; offset < DAYS_AHEAD; offset++) {
      const day = addDays(today, offset);
      if (!isScheduled(habit.days_mask, day)) continue;
      // Dziś już wykonane — dzisiejsze przypomnienie odpada.
      if (offset === 0 && habit.today_count >= habit.target_per_day) continue;
      const at = atTime(day, habit.reminder_time);
      if (at.getTime() <= now) continue;
      planned.push({
        id: `habit:${habit.id}:${day}:${habit.reminder_time}:${contentHash}`,
        at,
        title: `${habit.icon} ${habit.name}`,
        body: habit.unit
          ? `Cel na dziś: ${formatAmount(habit.target_per_day)} ${habit.unit}`
          : habit.target_per_day > 1
            ? `Cel na dziś: ${habit.target_per_day}×`
            : 'Pora na dzisiejszy nawyk.',
        url: '/nawyki',
        channel: 'habits',
      });
    }
  }
  return planned;
}

async function planTasks(db: SQLiteDatabase, today: DateKey, now: number): Promise<Planned[]> {
  const tasks = await db.getAllAsync<{ id: number; title: string; due_date: DateKey; due_time: string }>(
    `SELECT id, title, due_date, due_time FROM tasks
     WHERE completed_at IS NULL AND due_date IS NOT NULL AND due_time IS NOT NULL
       AND due_date BETWEEN $today AND $until
     ORDER BY due_date, due_time LIMIT ${MAX_TASK_REMINDERS}`,
    { $today: today, $until: addDays(today, TASKS_DAYS_AHEAD) },
  );
  return tasks
    .map((task) => ({
      id: `task:${task.id}:${task.due_date}:${task.due_time}:${hash(task.title)}`,
      at: atTime(task.due_date, task.due_time),
      title: `☑️ ${task.title}`,
      body: `Termin: ${task.due_time}`,
      url: `/zadanie/${task.id}`,
      channel: 'tasks' as const,
    }))
    .filter((planned) => planned.at.getTime() > now);
}

async function planReview(db: SQLiteDatabase, today: DateKey, now: number): Promise<Planned[]> {
  const time = await getSetting(db, 'review_time');
  if (!time) return [];
  const lastReview = await getSetting(db, 'last_review_date');
  const planned: Planned[] = [];
  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const day = addDays(today, offset);
    // Dzień już podsumowany — bez przypomnienia.
    if (day === lastReview) continue;
    const at = atTime(day, time);
    if (at.getTime() <= now) continue;
    planned.push({
      id: `review:${day}:${time}`,
      at,
      title: '🌙 Podsumuj dzień',
      body: 'Odhacz nawyki, oceń nastrój i zaplanuj jutro — to zajmie minutę.',
      url: '/podsumowanie',
      channel: 'review',
    });
  }
  return planned;
}

async function sync(db: SQLiteDatabase) {
  const Notifications = getNotifications();
  if (!Notifications) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = new Set(
    scheduled.map((request) => request.identifier).filter((id) => PREFIXES.some((prefix) => id.startsWith(prefix))),
  );

  const { granted } = await Notifications.getPermissionsAsync();
  const today = todayKey();
  const now = Date.now();
  const wanted = new Map<string, Planned>();
  if (granted) {
    const planned = [
      ...(await planHabits(db, today, now)),
      ...(await planTasks(db, today, now)),
      ...(await planReview(db, today, now)),
    ];
    for (const item of planned) wanted.set(item.id, item);
  }

  for (const id of existing) {
    if (!wanted.has(id)) await Notifications.cancelScheduledNotificationAsync(id);
  }
  const channels = new Set([...wanted.values()].map((item) => item.channel));
  for (const channel of channels) await ensureChannel(Notifications, channel);
  for (const [id, item] of wanted) {
    if (existing.has(id)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: item.title, body: item.body, data: { url: item.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: item.channel },
    });
  }
}

let running: Promise<void> | null = null;
let rerun = false;

/** Uzgadnia zaplanowane powiadomienia z bazą. Wywołania w trakcie synchronizacji łączą się w jedno. */
export function syncReminders(db: SQLiteDatabase): Promise<void> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    do {
      rerun = false;
      try {
        await sync(db);
      } catch (error) {
        console.warn('Przypomnienia:', error);
      }
    } while (rerun);
    running = null;
  })();
  return running;
}
