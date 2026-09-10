import type { SQLiteDatabase } from 'expo-sqlite';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, fromDateKey, todayKey } from '@/lib/dates';

/**
 * Przypomnienia o nawykach to lokalne powiadomienia zaplanowane na konkretne dni (najbliższe 14).
 * Dzięki temu dzisiejsze można pominąć, gdy nawyk jest już wykonany — codzienny powtarzalny
 * wyzwalacz by na to nie pozwolił. Plan odświeża się przy każdej zmianie nawyków i przy otwarciu aplikacji.
 */

const CHANNEL_ID = 'habits';
const DAYS_AHEAD = 14;
const ID_PREFIX = 'habit:';

let notificationsModule: typeof NotificationsModule | null | undefined;

/**
 * expo-notifications ładujemy leniwie: w Expo Go na Androidzie część modułu (push) jest wyłączona
 * i w razie błędu wolimy stracić przypomnienia niż wysypać całą aplikację.
 */
export function getNotifications() {
  if (notificationsModule === undefined) {
    try {
      notificationsModule = require('expo-notifications') as typeof NotificationsModule;
    } catch (error) {
      console.warn('Powiadomienia niedostępne:', error);
      notificationsModule = null;
    }
  }
  return notificationsModule;
}

async function ensureChannel(Notifications: typeof NotificationsModule) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Przypomnienia o nawykach',
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
  await ensureChannel(Notifications);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted ? 'granted' : 'denied';
}

type ReminderHabit = {
  id: number;
  name: string;
  icon: string;
  target_per_day: number;
  reminder_time: string;
  today_count: number;
};

/** Krótki skrót treści, żeby zmiana nazwy/ikony zaplanowała powiadomienia od nowa. */
function hash(text: string) {
  let value = 5381;
  for (let i = 0; i < text.length; i++) value = (value * 33 + text.charCodeAt(i)) >>> 0;
  return value.toString(36);
}

async function sync(db: SQLiteDatabase) {
  const Notifications = getNotifications();
  if (!Notifications) return;

  const today = todayKey();
  const habits = await db.getAllAsync<ReminderHabit>(
    `SELECT h.id, h.name, h.icon, h.target_per_day, h.reminder_time, COALESCE(l.count, 0) AS today_count
     FROM habits h LEFT JOIN habit_logs l ON l.habit_id = h.id AND l.date = $today
     WHERE h.archived = 0 AND h.reminder_time IS NOT NULL`,
    { $today: today },
  );
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = new Set(
    scheduled.map((request) => request.identifier).filter((id) => id.startsWith(ID_PREFIX)),
  );
  if (habits.length === 0 && existing.size === 0) return;

  const { granted } = await Notifications.getPermissionsAsync();
  const wanted = new Map<string, { habit: ReminderHabit; at: Date }>();
  if (granted) {
    const now = Date.now();
    for (const habit of habits) {
      const [hours, minutes] = habit.reminder_time.split(':').map(Number);
      const contentHash = hash(`${habit.name}|${habit.icon}|${habit.target_per_day}`);
      for (let offset = 0; offset < DAYS_AHEAD; offset++) {
        const day = addDays(today, offset);
        if (offset === 0 && habit.today_count >= habit.target_per_day) continue;
        const at = fromDateKey(day);
        at.setHours(hours, minutes, 0, 0);
        if (at.getTime() <= now) continue;
        wanted.set(`${ID_PREFIX}${habit.id}:${day}:${habit.reminder_time}:${contentHash}`, { habit, at });
      }
    }
  }

  for (const id of existing) {
    if (!wanted.has(id)) await Notifications.cancelScheduledNotificationAsync(id);
  }
  if (wanted.size > 0) await ensureChannel(Notifications);
  for (const [id, { habit, at }] of wanted) {
    if (existing.has(id)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: `${habit.icon} ${habit.name}`,
        body: habit.target_per_day > 1 ? `Cel na dziś: ${habit.target_per_day}×` : 'Pora na dzisiejszy nawyk.',
        data: { url: '/nawyki' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
    });
  }
}

let running: Promise<void> | null = null;
let rerun = false;

/** Uzgadnia zaplanowane powiadomienia z bazą. Wywołania w trakcie synchronizacji łączą się w jedno. */
export function syncHabitReminders(db: SQLiteDatabase): Promise<void> {
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
