import { diffDays, type DateKey } from './dates';
import { plural } from './format';

export type DueStatus = 'overdue' | 'today' | 'soon' | 'later';

/** Termin względem dziś: po terminie, dziś, w ciągu `soonDays` dni albo później. */
export function dueStatus(due: DateKey, today: DateKey, soonDays = 7): DueStatus {
  const days = diffDays(today, due);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return days <= soonDays ? 'soon' : 'later';
}

/** „Dziś”, „Jutro”, „za 5 dni”, „3 dni po terminie”. */
export function dueLabel(due: DateKey, today: DateKey) {
  const days = diffDays(today, due);
  if (days === 0) return 'Dziś';
  if (days === 1) return 'Jutro';
  if (days < 0) return `${plural(-days, ['dzień', 'dni', 'dni'])} po terminie`;
  return `za ${plural(days, ['dzień', 'dni', 'dni'])}`;
}
