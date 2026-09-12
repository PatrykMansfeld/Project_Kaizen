import { WEEKDAYS_SHORT, addDays, startOfWeek, toDateKey, weekdayIndex, type DateKey } from '@/lib/dates';

/** Maska dni tygodnia: bit 0 = poniedziałek … bit 6 = niedziela. */
export const EVERY_DAY = 127;
export const WORKDAYS = 0b0011111;
const WEEKEND = 0b1100000;

export function isScheduled(daysMask: number, day: DateKey) {
  return ((daysMask >> weekdayIndex(day)) & 1) === 1;
}

/** „Codziennie”, „Dni robocze”, „Weekendy” albo „pn, śr, pt”. */
export function formatDays(daysMask: number) {
  if (daysMask === EVERY_DAY) return 'Codziennie';
  if (daysMask === WORKDAYS) return 'Dni robocze';
  if (daysMask === WEEKEND) return 'Weekendy';
  return WEEKDAYS_SHORT.filter((_, index) => (daysMask >> index) & 1).join(', ');
}

/** Pierwszy dzień nawyku: utworzenie albo wcześniejsze wykonanie (dni można uzupełniać wstecz). */
export function habitStartDay(createdAt: string, doneDays: Iterable<DateKey>) {
  let start = toDateKey(new Date(createdAt));
  for (const day of doneDays) if (day < start) start = day;
  return start;
}

/**
 * Obecna seria: kolejne wykonania, licząc wstecz od dziś. Dni poza harmonogramem nie przerywają serii
 * (a wykonanie w taki dzień ją wydłuża). Niewykonane dziś też jej nie przerywa — dzień jeszcze trwa.
 * `since` — pierwszy dzień nawyku (dalej wstecz nie szukamy).
 */
export function currentStreak(doneDays: Set<DateKey>, today: DateKey, daysMask: number, since: DateKey) {
  let streak = 0;
  for (let day = today; day >= since; day = addDays(day, -1)) {
    if (doneDays.has(day)) streak++;
    else if (day !== today && isScheduled(daysMask, day)) break;
  }
  return streak;
}

/** Najdłuższa seria od `since` do dziś, liczona tak samo jak obecna. */
export function bestStreak(doneDays: Set<DateKey>, today: DateKey, daysMask: number, since: DateKey) {
  let best = 0;
  let run = 0;
  for (let day = since; day <= today; day = addDays(day, 1)) {
    if (doneDays.has(day)) {
      run++;
      best = Math.max(best, run);
    } else if (day !== today && isScheduled(daysMask, day)) {
      run = 0;
    }
  }
  return best;
}

export function formatStreak(days: number) {
  return `🔥 ${days} ${days === 1 ? 'dzień' : 'dni'}`;
}

// ——— Nawyki „X razy w tygodniu” (dowolne dni) ———————————————————————————————

/** Ile dni z wykonanym celem przypada na tydzień zaczynający się w `monday`. */
export function doneInWeek(doneDays: Set<DateKey>, monday: DateKey) {
  let count = 0;
  for (let offset = 0; offset < 7; offset++) if (doneDays.has(addDays(monday, offset))) count++;
  return count;
}

/**
 * Seria tygodni z osiągniętym celem, licząc wstecz od bieżącego. Bieżący tydzień wlicza się,
 * gdy cel już jest osiągnięty — w przeciwnym razie jeszcze trwa i serii nie przerywa.
 */
export function currentWeeklyStreak(doneDays: Set<DateKey>, today: DateKey, weeklyTarget: number, since: DateKey) {
  let streak = 0;
  const thisWeek = startOfWeek(today);
  for (let monday = thisWeek; addDays(monday, 6) >= since; monday = addDays(monday, -7)) {
    const met = doneInWeek(doneDays, monday) >= weeklyTarget;
    if (met) streak++;
    else if (monday !== thisWeek) break;
  }
  return streak;
}

/** Najdłuższa seria tygodni z osiągniętym celem. */
export function bestWeeklyStreak(doneDays: Set<DateKey>, today: DateKey, weeklyTarget: number, since: DateKey) {
  let best = 0;
  let run = 0;
  const thisWeek = startOfWeek(today);
  for (let monday = startOfWeek(since); monday <= thisWeek; monday = addDays(monday, 7)) {
    if (doneInWeek(doneDays, monday) >= weeklyTarget) {
      run++;
      best = Math.max(best, run);
    } else if (monday !== thisWeek) {
      run = 0;
    }
  }
  return best;
}

export function formatWeeklyStreak(weeks: number) {
  return `🔥 ${weeks} tyg.`;
}
