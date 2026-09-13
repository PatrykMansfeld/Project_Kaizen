import { isRunningInExpoGo } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { parseTimes } from '@/db/meds';
import { getSetting } from '@/db/settings';
import { formatMoney } from '@/features/finance/money';
import { formatAmount } from '@/features/habits/amount';
import { isScheduled } from '@/features/habits/streak';
import { addDays, formatDayShort, fromDateKey, startOfWeek, todayKey, type DateKey } from '@/lib/dates';
import { plural } from '@/lib/format';

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
  meds: 'Leki i suplementy',
  bills: 'Płatności',
  home: 'Dom',
  trips: 'Podróże',
} as const;

/** Dawki leków planujemy na krócej — każda godzina każdego dnia to osobne powiadomienie. */
const MEDS_DAYS_AHEAD = 7;
/** Obowiązki i płatności — w oknie takim jak zadania. */
const DUE_DAYS_AHEAD = 60;
/** Koniec gwarancji — przypomnienie tyle dni wcześniej. */
const WARRANTY_NOTICE_DAYS = 30;
/** Przypomnienie o pakowaniu — wieczorem dzień przed wyjazdem. */
const TRIP_REMINDER_TIME = '18:00';
type ChannelId = keyof typeof CHANNELS;

/** Każde zaplanowane przez nas powiadomienie ma identyfikator z jednym z tych przedrostków. */
const PREFIXES = ['habit:', 'task:', 'review:', 'weekly:', 'med:', 'bill:', 'chore:', 'warranty:', 'trip:'];

/**
 * W Expo Go na Androidzie sam import expo-notifications rzuca błąd (push usunięto z Expo Go w SDK 53),
 * więc tam przypomnienia są wyłączone — działają dopiero w zbudowanej aplikacji (APK / development build).
 */
export const notificationsSupported = !(Platform.OS === 'android' && isRunningInExpoGo());

/** Podpis pod ustawionym przypomnieniem, gdy powiadomienia nie działają (Expo Go). */
export const EXPO_GO_NOTICE =
  'W Expo Go powiadomienia nie działają — przypomnienie zacznie przychodzić po zainstalowaniu aplikacji (APK).';

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
    weekly_target: number | null;
    today_count: number;
    week_done: number;
  }>(
    `SELECT h.id, h.name, h.icon, h.target_per_day, h.unit, h.reminder_time, h.days_mask, h.weekly_target,
       COALESCE(l.count, 0) AS today_count,
       (SELECT COUNT(*) FROM habit_logs w
        WHERE w.habit_id = h.id AND w.count >= h.target_per_day AND w.date BETWEEN $weekStart AND $weekEnd) AS week_done
     FROM habits h LEFT JOIN habit_logs l ON l.habit_id = h.id AND l.date = $today
     WHERE h.archived = 0 AND h.reminder_time IS NOT NULL`,
    { $today: today, $weekStart: startOfWeek(today), $weekEnd: addDays(startOfWeek(today), 6) },
  );
  const planned: Planned[] = [];
  for (const habit of habits) {
    const contentHash = hash(`${habit.name}|${habit.icon}|${habit.target_per_day}|${habit.unit ?? ''}`);
    for (let offset = 0; offset < DAYS_AHEAD; offset++) {
      const day = addDays(today, offset);
      if (!isScheduled(habit.days_mask, day)) continue;
      // „X razy w tygodniu”: po osiągnięciu celu do końca bieżącego tygodnia bez przypomnień.
      if (habit.weekly_target && habit.week_done >= habit.weekly_target && startOfWeek(day) === startOfWeek(today)) continue;
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
        url: '/modul/nawyki',
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

/** Przegląd tygodnia: ustawiony dzień tygodnia i godzina, najbliższe 4 tygodnie; zrobiony tydzień pomijamy. */
async function planWeeklyReview(db: SQLiteDatabase, today: DateKey, now: number): Promise<Planned[]> {
  const setting = await getSetting(db, 'weekly_review_time');
  const match = setting?.match(/^([0-6]) (\d{2}:\d{2})$/);
  if (!match) return [];
  const weekday = Number(match[1]);
  const time = match[2];
  const done = new Set(
    (await db.getAllAsync<{ week_start: DateKey }>('SELECT week_start FROM weekly_reviews WHERE week_start >= ?', addDays(startOfWeek(today), -7))).map(
      (row) => row.week_start,
    ),
  );
  const planned: Planned[] = [];
  for (let week = 0; week < 4; week++) {
    const day = addDays(startOfWeek(today), week * 7 + weekday);
    // Przegląd dotyczy tygodnia, w którym leży przypomnienie (od piątku) albo poprzedniego.
    const reviewedWeek = weekday >= 4 ? startOfWeek(day) : addDays(startOfWeek(day), -7);
    if (done.has(reviewedWeek)) continue;
    const at = atTime(day, time);
    if (at.getTime() <= now) continue;
    planned.push({
      id: `weekly:${day}:${time}`,
      at,
      title: '📅 Przegląd tygodnia',
      body: 'Co poszło dobrze, co poprawić i jakie 3 priorytety na kolejny tydzień?',
      url: '/przeglad-tygodnia',
      channel: 'review',
    });
  }
  return planned;
}

/** Dawki leków z harmonogramem (bez już odhaczonych). */
async function planMeds(db: SQLiteDatabase, today: DateKey, now: number): Promise<Planned[]> {
  const meds = await db.getAllAsync<{ id: number; name: string; dose: string; icon: string; times: string; days_mask: number }>(
    `SELECT id, name, dose, icon, times, days_mask FROM medications WHERE active = 1 AND reminders = 1 AND times <> ''`,
  );
  const taken = new Set(
    (
      await db.getAllAsync<{ medication_id: number; date: DateKey; time: string }>(
        'SELECT medication_id, date, time FROM medication_logs WHERE date >= ?',
        today,
      )
    ).map((log) => `${log.medication_id}|${log.date}|${log.time}`),
  );
  const planned: Planned[] = [];
  for (const med of meds) {
    const contentHash = hash(`${med.name}|${med.dose}|${med.icon}`);
    for (let offset = 0; offset < MEDS_DAYS_AHEAD; offset++) {
      const day = addDays(today, offset);
      if (!isScheduled(med.days_mask, day)) continue;
      for (const time of parseTimes(med.times)) {
        if (taken.has(`${med.id}|${day}|${time}`)) continue;
        const at = atTime(day, time);
        if (at.getTime() <= now) continue;
        planned.push({
          id: `med:${med.id}:${day}:${time}:${contentHash}`,
          at,
          title: `${med.icon} ${med.name}`,
          body: med.dose ? `Pora na dawkę: ${med.dose}` : 'Pora na dawkę.',
          url: '/modul/leki',
          channel: 'meds',
        });
      }
    }
  }
  return planned;
}

/** Stałe opłaty: X dni przed terminem o 9:00. */
async function planBills(db: SQLiteDatabase, today: DateKey, now: number): Promise<Planned[]> {
  const bills = await db.getAllAsync<{ id: number; name: string; icon: string; amount: number; next_due: DateKey; remind_days_before: number }>(
    `SELECT id, name, icon, amount, next_due, remind_days_before FROM recurring_bills
     WHERE active = 1 AND remind_days_before IS NOT NULL AND next_due <= $until`,
    { $until: addDays(today, DUE_DAYS_AHEAD) },
  );
  return bills
    .map((bill) => ({
      id: `bill:${bill.id}:${bill.next_due}:${bill.remind_days_before}:${hash(`${bill.name}|${bill.amount}`)}`,
      at: atTime(addDays(bill.next_due, -bill.remind_days_before), '09:00'),
      title: `${bill.icon} ${bill.name}: ${formatMoney(bill.amount)}`,
      body: bill.remind_days_before === 0 ? 'Termin płatności dziś.' : `Termin płatności: ${formatDayShort(bill.next_due, today)}.`,
      url: '/modul/oplaty',
      channel: 'bills' as const,
    }))
    .filter((planned) => planned.at.getTime() > now);
}

/** Obowiązki domowe z przypomnieniem: w dniu terminu o 9:00. */
async function planChores(db: SQLiteDatabase, today: DateKey, now: number): Promise<Planned[]> {
  const chores = await db.getAllAsync<{ id: number; name: string; icon: string; next_due: DateKey }>(
    'SELECT id, name, icon, next_due FROM home_chores WHERE remind = 1 AND next_due BETWEEN $today AND $until',
    { $today: today, $until: addDays(today, DUE_DAYS_AHEAD) },
  );
  return chores
    .map((chore) => ({
      id: `chore:${chore.id}:${chore.next_due}:${hash(chore.name)}`,
      at: atTime(chore.next_due, '09:00'),
      title: `${chore.icon} ${chore.name}`,
      body: 'Dziś w planie domowych obowiązków.',
      url: '/modul/dom',
      channel: 'home' as const,
    }))
    .filter((planned) => planned.at.getTime() > now);
}

/** Gwarancje: miesiąc przed końcem o 10:00. */
async function planWarranties(db: SQLiteDatabase, today: DateKey, now: number): Promise<Planned[]> {
  const warranties = await db.getAllAsync<{ id: number; name: string; expires_on: DateKey }>(
    'SELECT id, name, expires_on FROM warranties WHERE expires_on > $today',
    { $today: today },
  );
  return warranties
    .map((warranty) => ({
      id: `warranty:${warranty.id}:${warranty.expires_on}:${hash(warranty.name)}`,
      at: atTime(addDays(warranty.expires_on, -WARRANTY_NOTICE_DAYS), '10:00'),
      title: `🧾 Kończy się gwarancja: ${warranty.name}`,
      body: `Ważna do ${formatDayShort(warranty.expires_on, today)} — sprawdź sprzęt, zanim minie termin.`,
      url: '/modul/dom',
      channel: 'home' as const,
    }))
    .filter((planned) => planned.at.getTime() > now);
}

async function planTrips(db: SQLiteDatabase, today: DateKey, now: number): Promise<Planned[]> {
  const trips = await db.getAllAsync<{ id: number; name: string; icon: string; start_date: DateKey; total: number; remaining: number }>(
    `SELECT t.id, t.name, t.icon, t.start_date,
       (SELECT COUNT(*) FROM trip_items i WHERE i.trip_id = t.id AND i.kind = 'pack') AS total,
       (SELECT COUNT(*) FROM trip_items i WHERE i.trip_id = t.id AND i.kind = 'pack' AND i.done = 0) AS remaining
     FROM trips t WHERE t.start_date > $today AND t.start_date <= $until`,
    { $today: today, $until: addDays(today, DUE_DAYS_AHEAD) },
  );
  return trips
    .map((trip) => ({
      // Liczba rzeczy do spakowania w identyfikatorze — zmiana listy odświeża treść powiadomienia.
      id: `trip:${trip.id}:${trip.start_date}:${hash(`${trip.name}|${trip.remaining}|${trip.total}`)}`,
      at: atTime(addDays(trip.start_date, -1), TRIP_REMINDER_TIME),
      title: `${trip.icon} Jutro wyjazd: ${trip.name}`,
      body:
        trip.remaining > 0
          ? `Do spakowania: ${plural(trip.remaining, ['rzecz', 'rzeczy', 'rzeczy'])}. Sprawdź listę przed wyjazdem.`
          : trip.total > 0
            ? 'Wszystko spakowane — udanej podróży!'
            : 'Dokumenty, bilety, ładowarka? Udanej podróży!',
      url: `/podroz/${trip.id}`,
      channel: 'trips' as const,
    }))
    .filter((planned) => planned.at.getTime() > now);
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
      ...(await planWeeklyReview(db, today, now)),
      ...(await planMeds(db, today, now)),
      ...(await planBills(db, today, now)),
      ...(await planChores(db, today, now)),
      ...(await planWarranties(db, today, now)),
      ...(await planTrips(db, today, now)),
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
