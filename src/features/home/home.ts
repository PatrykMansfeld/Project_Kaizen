import type { Meter, MeterReading } from '@/db/home';
import { diffDays, type DateKey } from '@/lib/dates';
import { FORMS, formatDecimal, plural } from '@/lib/format';

export const HOME_ICONS = ['🧹', '🧺', '🧽', '🗑️', '🪴', '🛏️', '🚿', '💧', '🔥', '🧊', '🔋', '🪟', '🔧', '🐶', '🚗', '🌡️'];

export const METER_ICONS = ['⚡', '💧', '🔥', '🌡️', '🚗', '📟'];

export const METER_UNITS = ['kWh', 'm³', 'GJ', 'l', 'km'];

export const CHORE_INTERVALS = [
  { days: 7, label: 'Co tydzień' },
  { days: 14, label: 'Co 2 tygodnie' },
  { days: 30, label: 'Co miesiąc' },
  { days: 90, label: 'Co 3 miesiące' },
  { days: 180, label: 'Co pół roku' },
  { days: 365, label: 'Co rok' },
];

/** „co 90 dni” albo nazwa z CHORE_INTERVALS. */
export function intervalLabel(days: number) {
  return CHORE_INTERVALS.find((option) => option.days === days)?.label.toLowerCase() ?? `co ${plural(days, FORMS.day)}`;
}

/** Dni do końca gwarancji przy których pokazujemy ostrzeżenie. */
export const WARRANTY_WARNING_DAYS = 30;

/** „wygasa za 20 dni”, „ważna jeszcze 400 dni”, „wygasła 3 dni temu”. */
export function warrantyLabel(expiresOn: DateKey, today: DateKey) {
  const days = diffDays(today, expiresOn);
  if (days < 0) return `wygasła ${plural(-days, FORMS.day)} temu`;
  if (days === 0) return 'wygasa dziś';
  if (days <= WARRANTY_WARNING_DAYS) return `wygasa za ${plural(days, FORMS.day)}`;
  return `ważna jeszcze ${plural(days, FORMS.day)}`;
}

export type MeterUsage = { amount: number; days: number; perDay: number | null };

/** Zużycie między dwoma ostatnimi odczytami (od starszego do nowszego). */
export function meterUsage(
  last: { value: number | null; date: DateKey | null },
  previous: { value: number | null; date: DateKey | null },
): MeterUsage | null {
  if (last.value === null || last.date === null || previous.value === null || previous.date === null) return null;
  const days = diffDays(previous.date, last.date);
  const amount = last.value - previous.value;
  return { amount, days, perDay: days > 0 ? amount / days : null };
}

/** „+123 kWh w 30 dni (4,1 kWh dziennie)”. */
export function formatUsage(usage: MeterUsage, unit: Meter['unit']) {
  const perDay = usage.perDay !== null ? ` (${formatDecimal(usage.perDay, 1)} ${unit} dziennie)` : '';
  return `${usage.amount >= 0 ? '+' : ''}${formatDecimal(usage.amount, 2)} ${unit} w ${plural(usage.days, FORMS.day)}${perDay}`;
}

/** Zużycie w kolejnych okresach między odczytami (od najstarszego) — do historii licznika. */
export function readingDeltas(readings: readonly MeterReading[]) {
  const chronological = [...readings].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return chronological.slice(1).map((reading, index) => ({
    reading,
    usage: meterUsage(
      { value: reading.value, date: reading.date },
      { value: chronological[index].value, date: chronological[index].date },
    )!,
  }));
}
