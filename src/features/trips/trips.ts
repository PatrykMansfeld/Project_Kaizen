import type { NewTripItem, Trip, TripItem, TripWithTotals } from '@/db/trips';
import { addDays, diffDays, type DateKey } from '@/lib/dates';
import { FORMS, plural } from '@/lib/format';
import { normalizeForSearch } from '@/lib/search';

export const TRIP_ICONS = ['✈️', '🏖️', '⛰️', '🏙️', '🚗', '🚆', '⛺', '🎿', '🚢', '🏝️', '🗺️', '🏰', '🍷', '🎒', '🚲', '🌋'];

export type TripPhase = 'upcoming' | 'ongoing' | 'past';

type TripDates = Pick<Trip, 'start_date' | 'end_date'>;

export function tripPhase(trip: TripDates, today: DateKey): TripPhase {
  if (today < trip.start_date) return 'upcoming';
  return today > trip.end_date ? 'past' : 'ongoing';
}

/** Liczba dni wyjazdu (włącznie z dniem wyjazdu i powrotu). */
export function tripLength(trip: TripDates) {
  return diffDays(trip.start_date, trip.end_date) + 1;
}

export function tripDates(trip: TripDates): DateKey[] {
  return Array.from({ length: tripLength(trip) }, (_, index) => addDays(trip.start_date, index));
}

/** „Jutro wyjazd”, „za 12 dni”, „Dzień 3 z 7”, „7 dni”. */
export function tripStatusLabel(trip: TripDates, today: DateKey) {
  switch (tripPhase(trip, today)) {
    case 'upcoming': {
      const days = diffDays(today, trip.start_date);
      return days === 1 ? 'Jutro wyjazd' : `za ${plural(days, FORMS.day)}`;
    }
    case 'ongoing':
      return `Dzień ${diffDays(trip.start_date, today) + 1} z ${tripLength(trip)}`;
    case 'past':
      return plural(tripLength(trip), FORMS.day);
  }
}

/** Numer dnia wyjazdu (1 = dzień wyjazdu). */
export function tripDayNumber(trip: TripDates, date: DateKey) {
  return diffDays(trip.start_date, date) + 1;
}

// ——— Lista pakowania

export const PACK_CATEGORIES = ['Dokumenty', 'Ubrania', 'Kosmetyki', 'Elektronika', 'Apteczka', 'Inne'];

type PackTemplate = { key: string; label: string; emoji: string; items: { text: string; category: string }[] };

const pack = (category: string, texts: string[]) => texts.map((text) => ({ text, category }));

export const PACKING_TEMPLATES: PackTemplate[] = [
  {
    key: 'basic',
    label: 'Podstawy',
    emoji: '🎒',
    items: [
      ...pack('Dokumenty', ['Dowód osobisty / paszport', 'Karta płatnicza', 'Gotówka', 'Bilety i rezerwacje', 'Ubezpieczenie / EKUZ']),
      ...pack('Ubrania', ['Bielizna', 'Skarpetki', 'Koszulki', 'Spodnie', 'Piżama', 'Wygodne buty']),
      ...pack('Kosmetyki', ['Szczoteczka i pasta', 'Dezodorant', 'Szampon i żel']),
      ...pack('Elektronika', ['Telefon', 'Ładowarka', 'Powerbank', 'Słuchawki']),
      ...pack('Apteczka', ['Leki, które biorę', 'Środki przeciwbólowe', 'Plastry']),
    ],
  },
  {
    key: 'beach',
    label: 'Plaża',
    emoji: '🏖️',
    items: [
      ...pack('Ubrania', ['Strój kąpielowy', 'Klapki', 'Nakrycie głowy', 'Sukienka / krótkie spodenki']),
      ...pack('Kosmetyki', ['Krem z filtrem', 'Balsam po opalaniu']),
      ...pack('Inne', ['Ręcznik plażowy', 'Okulary przeciwsłoneczne', 'Torba plażowa']),
    ],
  },
  {
    key: 'mountains',
    label: 'Góry',
    emoji: '⛰️',
    items: [
      ...pack('Ubrania', ['Buty trekkingowe', 'Kurtka przeciwdeszczowa', 'Polar', 'Czapka', 'Skarpety trekkingowe']),
      ...pack('Inne', ['Plecak', 'Czołówka', 'Bidon / termos', 'Mapa offline']),
      ...pack('Apteczka', ['Folia NRC', 'Plastry na otarcia']),
    ],
  },
  {
    key: 'winter',
    label: 'Zima i narty',
    emoji: '🎿',
    items: [
      ...pack('Ubrania', ['Kurtka zimowa', 'Spodnie narciarskie', 'Bielizna termoaktywna', 'Rękawice', 'Komin / szalik', 'Czapka']),
      ...pack('Inne', ['Gogle', 'Kask', 'Karnet']),
      ...pack('Kosmetyki', ['Krem ochronny na mróz', 'Pomadka']),
    ],
  },
  {
    key: 'plane',
    label: 'Samolot',
    emoji: '✈️',
    items: [
      ...pack('Dokumenty', ['Karta pokładowa']),
      ...pack('Kosmetyki', ['Płyny do 100 ml w woreczku']),
      ...pack('Elektronika', ['Adapter do gniazdka', 'Filmy pobrane offline']),
      ...pack('Inne', ['Poduszka podróżna', 'Pusta butelka na wodę']),
    ],
  },
  {
    key: 'business',
    label: 'Służbowy',
    emoji: '💼',
    items: [
      ...pack('Elektronika', ['Laptop', 'Ładowarka do laptopa', 'Przejściówki']),
      ...pack('Ubrania', ['Koszula', 'Marynarka', 'Eleganckie buty']),
      ...pack('Inne', ['Notes i długopis', 'Wizytówki']),
    ],
  },
];

/** „skarpetki, czapka\nkrem” → trzy punkty (bez pustych i powtórzeń). */
export function parsePackText(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of text.split(/[,\n;]/)) {
    const item = part.trim().replace(/\s+/g, ' ');
    const key = normalizeForSearch(item);
    if (item && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/** Punkty do dodania: bez tych, które już są na liście (bez względu na wielkość liter i polskie znaki). */
export function newPackingItems(existing: readonly Pick<TripItem, 'text'>[], candidates: readonly { text: string; category: string }[]): NewTripItem[] {
  const seen = new Set(existing.map((item) => normalizeForSearch(item.text.trim())));
  const result: NewTripItem[] = [];
  for (const candidate of candidates) {
    const key = normalizeForSearch(candidate.text.trim());
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({ kind: 'pack', text: candidate.text.trim(), category: candidate.category, date: null, time: null });
  }
  return result;
}

/** Lista pakowania w grupach: najpierw znane kategorie w stałej kolejności, potem własne, na końcu „Inne”. */
export function packGroups<T extends Pick<TripItem, 'category'>>(items: readonly T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const category = item.category.trim() || 'Inne';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(item);
  }
  const rank = (category: string) => {
    if (category === 'Inne') return PACK_CATEGORIES.length + 1;
    const index = PACK_CATEGORIES.indexOf(category);
    return index === -1 ? PACK_CATEGORIES.length : index;
  };
  return [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'pl'));
}

// ——— Plan

/** Przy dłuższych wyjazdach pokazujemy tylko dni, na które coś jest w planie. */
const MAX_EMPTY_PLAN_DAYS = 21;

/** Plan po dniach (dni bez planu też, żeby było gdzie dopisać) i na końcu pomysły bez dnia (date: null). */
export function planDays<T extends Pick<TripItem, 'date'>>(trip: TripDates, items: readonly T[]): { date: DateKey | null; items: T[] }[] {
  const showEmpty = tripLength(trip) <= MAX_EMPTY_PLAN_DAYS;
  const days = tripDates(trip)
    .map((date) => ({ date: date as DateKey | null, items: items.filter((item) => item.date === date) }))
    .filter((day) => showEmpty || day.items.length > 0);
  return [...days, { date: null, items: items.filter((item) => item.date === null) }];
}

// ——— Podsumowania i wydatki

/** Minione wyjazdy z danego roku (po dacie wyjazdu): ile, ile dni w drodze i ile wydane. */
export function tripsYearSummary(trips: readonly TripWithTotals[], year: number) {
  const inYear = trips.filter((trip) => trip.start_date.startsWith(`${year}-`));
  return {
    count: inYear.length,
    days: inYear.reduce((sum, trip) => sum + tripLength(trip), 0),
    spent: inYear.reduce((sum, trip) => sum + trip.spent, 0),
  };
}

/** Podróż, w trakcie której wypada dzień (przy nakładaniu się — ta, która zaczęła się później). */
export function tripOnDate<T extends Trip>(trips: readonly T[], date: DateKey): T | null {
  return [...trips].filter((trip) => date >= trip.start_date && date <= trip.end_date).sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null;
}

/** Podróż do pokazania na ekranie Dziś: trwająca albo najbliższa w ciągu `withinDays` dni. */
export function highlightedTrip<T extends Trip>(trips: readonly T[], today: DateKey, withinDays = 14): T | null {
  const upcoming = trips
    .filter((trip) => trip.start_date > today && diffDays(today, trip.start_date) <= withinDays)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  return tripOnDate(trips, today) ?? upcoming[0] ?? null;
}

/** Ile dni przed wyjazdem wydatki (bilety, noclegi) mogą jeszcze do niego należeć — i ile po powrocie. */
const BOOKING_DAYS_BEFORE = 120;
const DAYS_AFTER = 14;

/** Podróże do wyboru przy wydatku z danego dnia (plus już wybrana, nawet gdy jest dalej). */
export function tripOptionsForDate<T extends Trip>(trips: readonly T[], date: DateKey, selectedId: number | null): T[] {
  return trips.filter(
    (trip) =>
      trip.id === selectedId || (date >= addDays(trip.start_date, -BOOKING_DAYS_BEFORE) && date <= addDays(trip.end_date, DAYS_AFTER)),
  );
}
