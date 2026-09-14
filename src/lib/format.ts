/** Polska odmiana: plural(5, ['zadanie', 'zadania', 'zadań']) → „5 zadań”. */
export function plural(count: number, [one, few, many]: [string, string, string]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    count === 1 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${count} ${word}`;
}

/** Najczęstsze odmiany do `plural` („1 dzień”, „2 dni”, „5 dni”). */
export const FORMS: Record<'day' | 'week' | 'workout' | 'task', [string, string, string]> = {
  day: ['dzień', 'dni', 'dni'],
  week: ['tydzień', 'tygodnie', 'tygodni'],
  workout: ['trening', 'treningi', 'treningów'],
  task: ['zadanie', 'zadania', 'zadań'],
};

/** 45 → „45 min”, 75 → „1 h 15 min”, 120 → „2 h”. */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Liczba z polskim przecinkiem, maksymalnie `decimals` miejsc po przecinku: 5.25 → „5,25”. */
export function formatDecimal(value: number, decimals = 2) {
  return String(Number(value.toFixed(decimals))).replace('.', ',');
}

export function formatKm(km: number) {
  return `${formatDecimal(km)} km`;
}

/** Liczba całkowita ≥ 0 z pola tekstowego („ 12 ” → 12); puste albo cokolwiek innego → null. */
export function parseWholeNumber(text: string | null | undefined) {
  const trimmed = (text ?? '').trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/** Tekst z pola liczbowego („5,2” albo „5.2”) → liczba; pusty → null, niepoprawny → NaN. */
export function parseDecimal(text: string) {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') return null;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

/** Pierwsza litera wielka: „czwartek, 10 września” → „Czwartek, 10 września”. */
export function capitalize(text: string) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** Zmiana ze znakiem: „+2”, „−1,5 kg”, „±0” (minus typograficzny). */
export function formatSigned(value: number, format: (absolute: number) => string) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${format(Math.abs(value))}`;
}
