/**
 * Wszystko, co jest przypisane do dnia (nawyki, dziennik, terminy zadań, treningi), zapisujemy
 * jako lokalną datę kalendarzową 'YYYY-MM-DD' — bez godziny i strefy czasowej. Dzięki temu wpis
 * z 23:30 nie „przeskoczy” na kolejny dzień, a daty można porównywać zwykłym porównaniem napisów.
 * Tydzień zaczyna się w poniedziałek.
 */
export type DateKey = string;

export const MONTHS = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
];

const MONTHS_GENITIVE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

/** Od poniedziałku. */
export const WEEKDAYS = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
export const WEEKDAYS_SHORT = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];

export function isDateKey(value: unknown): value is DateKey {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey(): DateKey {
  return toDateKey(new Date());
}

/** Lokalna północ danego dnia. */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** +N miesięcy; dzień przycinany do długości miesiąca (31 stycznia + 1 → 28/29 lutego). */
export function addMonths(key: DateKey, months: number): DateKey {
  const [y, m, d] = key.split('-').map(Number);
  const lastDay = new Date(y, m - 1 + months + 1, 0).getDate();
  return toDateKey(new Date(y, m - 1 + months, Math.min(d, lastDay)));
}

/** Liczba dni od `from` do `to` (ujemna, gdy `to` jest wcześniej). */
export function diffDays(from: DateKey, to: DateKey): number {
  // Liczone w UTC, żeby zmiana czasu letni/zimowy nie dawała 23- lub 25-godzinnych dób.
  const utc = (key: DateKey) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** 0 = poniedziałek … 6 = niedziela. */
export function weekdayIndex(key: DateKey): number {
  return (fromDateKey(key).getDay() + 6) % 7;
}

export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, -weekdayIndex(key));
}

/** Siedem dni tygodnia, w którym leży `key`, od poniedziałku. */
export function weekOf(key: DateKey): DateKey[] {
  const monday = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** `month`: 0–11. */
export type YearMonth = { year: number; month: number };

export function monthOf(key: DateKey): YearMonth {
  const date = fromDateKey(key);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** Miesiąc jako pełne tygodnie (pn–nd), łącznie z dniami sąsiednich miesięcy. `month`: 0–11. */
export function monthWeeks(year: number, month: number): DateKey[][] {
  const first = toDateKey(new Date(year, month, 1));
  const last = toDateKey(new Date(year, month + 1, 0));
  const weeks: DateKey[][] = [];
  for (let monday = startOfWeek(first); monday <= last; monday = addDays(monday, 7)) {
    weeks.push(weekOf(monday));
  }
  return weeks;
}

/** „czwartek, 10 września” */
export function formatDayLong(key: DateKey): string {
  const date = fromDateKey(key);
  return `${WEEKDAYS[weekdayIndex(key)]}, ${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** „10 września”, z rokiem, jeśli inny niż bieżący. */
export function formatDayShort(key: DateKey, today: DateKey = todayKey()): string {
  const date = fromDateKey(key);
  const base = `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
  return key.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${date.getFullYear()}`;
}

/** „7–13 września”, „28 września – 4 października”, z rokiem, jeśli inny niż bieżący. */
export function formatDateRange(from: DateKey, to: DateKey, today: DateKey = todayKey()): string {
  const a = fromDateKey(from);
  const b = fromDateKey(to);
  const year = b.getFullYear() !== fromDateKey(today).getFullYear() ? ` ${b.getFullYear()}` : '';
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS_GENITIVE[b.getMonth()]}${year}`;
  return `${a.getDate()} ${MONTHS_GENITIVE[a.getMonth()]} – ${b.getDate()} ${MONTHS_GENITIVE[b.getMonth()]}${year}`;
}

/** „Dziś”, „Wczoraj”, „Jutro”, a dalej „10 września” — do list i podpisów. */
export function formatDayRelative(key: DateKey, today: DateKey = todayKey()): string {
  return relativeDayLabel(key, today) ?? formatDayShort(key, today);
}

/** Znacznik czasu ISO → „Dziś, 14:32”, „Wczoraj, 9:05” albo „8 września”. */
export function formatTimestamp(iso: string, today: DateKey = todayKey()): string {
  const date = new Date(iso);
  const day = toDateKey(date);
  const relative = relativeDayLabel(day, today);
  if (relative === 'Dziś' || relative === 'Wczoraj') {
    return `${relative}, ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return formatDayShort(day, today);
}

/** „Dziś”, „Jutro”, „Wczoraj” albo null dla dalszych dni. */
export function relativeDayLabel(key: DateKey, today: DateKey = todayKey()): string | null {
  switch (diffDays(today, key)) {
    case 0:
      return 'Dziś';
    case 1:
      return 'Jutro';
    case -1:
      return 'Wczoraj';
    default:
      return null;
  }
}
