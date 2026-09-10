/** Polska odmiana: plural(5, ['zadanie', 'zadania', 'zadań']) → „5 zadań”. */
export function plural(count: number, [one, few, many]: [string, string, string]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    count === 1 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${count} ${word}`;
}

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

/** Tekst z pola liczbowego („5,2” albo „5.2”) → liczba; pusty → null, niepoprawny → NaN. */
export function parseDecimal(text: string) {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') return null;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}
