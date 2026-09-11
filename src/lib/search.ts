const DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
};

/**
 * Tekst do porównań przy wyszukiwaniu: małe litery i bez polskich znaków („Żółw” → „zolw”).
 * Szukamy w JS, a nie przez LIKE — SQLite ignoruje wielkość liter tylko w ASCII.
 * Zamiana znak po znaku zachowuje długość, więc pozycje trafień pasują do oryginału.
 */
export function normalizeForSearch(text: string) {
  return text.toLowerCase().replace(/[ąćęłńóśźż]/g, (char) => DIACRITICS[char]);
}

/** Czy tekst zawiera zapytanie (zapytanie już znormalizowane). */
export function matchesSearch(text: string, normalizedQuery: string) {
  return normalizeForSearch(text).includes(normalizedQuery);
}

/** Fragment tekstu wokół pierwszego trafienia: { before, match, after } do pogrubienia trafienia. */
export function searchSnippet(text: string, normalizedQuery: string, radius = 40) {
  const flat = text.replace(/\s+/g, ' ').trim();
  const index = normalizeForSearch(flat).indexOf(normalizedQuery);
  if (index < 0) return { before: flat.slice(0, radius * 2), match: '', after: '' };
  const start = Math.max(0, index - radius);
  const end = Math.min(flat.length, index + normalizedQuery.length + radius);
  return {
    before: (start > 0 ? '…' : '') + flat.slice(start, index),
    match: flat.slice(index, index + normalizedQuery.length),
    after: flat.slice(index + normalizedQuery.length, end) + (end < flat.length ? '…' : ''),
  };
}
