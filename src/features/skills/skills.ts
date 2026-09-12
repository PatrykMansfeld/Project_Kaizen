import type { PracticeSession } from '@/db/skills';
import { addDays, startOfWeek, type DateKey } from '@/lib/dates';
import { formatDecimal } from '@/lib/format';

export const SKILL_ICONS = ['🎸', '🎹', '🎤', '🎨', '📷', '💻', '🧠', '🗣️', '📚', '✍️', '♟️', '🧘', '🏀', '🥋', '🍳', '🔧'];

export const QUICK_MINUTES = [15, 30, 60];

export const GOAL_OPTIONS = [20, 50, 100, 500, 1000];

/** Minuty jako godziny z przecinkiem: 750 → „12,5 h”. */
export function formatHours(minutes: number) {
  return `${formatDecimal(minutes / 60, 1)} h`;
}

/** Minuty w kolejnych tygodniach (od najstarszego) — `weeks` ostatnich tygodni łącznie z bieżącym. */
export function weeklyMinutes(sessions: readonly Pick<PracticeSession, 'date' | 'minutes'>[], today: DateKey, weeks = 8) {
  const thisWeek = startOfWeek(today);
  const buckets = Array.from({ length: weeks }, (_, index) => ({ start: addDays(thisWeek, -7 * (weeks - 1 - index)), minutes: 0 }));
  for (const session of sessions) {
    const bucket = buckets.find((item) => session.date >= item.start && session.date <= addDays(item.start, 6));
    if (bucket) bucket.minutes += session.minutes;
  }
  return buckets;
}

/**
 * Za ile tygodni cel zostanie osiągnięty przy średnim tempie z ostatnich tygodni;
 * null — brak celu, cel osiągnięty albo brak ostatnich sesji.
 */
export function weeksToGoal(totalMinutes: number, goalHours: number | null, recentWeeklyAverage: number) {
  if (!goalHours) return null;
  const remaining = goalHours * 60 - totalMinutes;
  if (remaining <= 0 || recentWeeklyAverage <= 0) return null;
  return Math.ceil(remaining / recentWeeklyAverage);
}
