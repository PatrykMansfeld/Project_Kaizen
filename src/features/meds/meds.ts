import { parseTimes, type Medication } from '@/db/meds';
import { isScheduled } from '@/features/habits/streak';
import type { DateKey } from '@/lib/dates';

/** Poniżej tylu dni zapasu pokazujemy „Kup zapas”. */
export const LOW_STOCK_DAYS = 7;

export const MED_ICONS = ['💊', '💉', '🧴', '🍵', '🌿', '🐟', '☀️', '🧪', '🩹', '👁️', '🦷', '❤️', '🧠', '🦴', '🍋', '🥛'];

export type DoseSlot = { med: Medication; time: string };

/** Dawki zaplanowane na dzień (aktywne leki z godzinami), po godzinie i nazwie. */
export function dosesForDay(meds: readonly Medication[], date: DateKey): DoseSlot[] {
  return meds
    .filter((med) => med.active && isScheduled(med.days_mask, date))
    .flatMap((med) => parseTimes(med.times).map((time) => ({ med, time })))
    .sort((a, b) => a.time.localeCompare(b.time) || a.med.name.localeCompare(b.med.name, 'pl'));
}

/** Na ile dni starczy zapasu przy obecnym harmonogramie; null — lek doraźny albo zapas nie jest liczony. */
export function daysOfSupply(med: Pick<Medication, 'stock' | 'times' | 'days_mask' | 'per_dose'>) {
  const perDay = parseTimes(med.times).length;
  if (med.stock === null || perDay === 0) return null;
  let daysPerWeek = 0;
  for (let bit = 0; bit < 7; bit++) if ((med.days_mask >> bit) & 1) daysPerWeek++;
  const unitsPerDay = (perDay * med.per_dose * daysPerWeek) / 7;
  return Math.floor(med.stock / unitsPerDay);
}

/** Aktualna godzina 'HH:MM' — dla dawek leków doraźnych. */
export function currentTime(now = new Date()) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
