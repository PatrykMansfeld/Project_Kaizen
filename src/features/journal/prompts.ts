import type { DateKey } from '@/lib/dates';

/** Pytania do dziennika — sformułowane bezosobowo, żeby pasowały każdemu. */
export const JOURNAL_PROMPTS = [
  'Za co dziś czuję wdzięczność?',
  'Co dziś poszło dobrze?',
  'Czego nauczył mnie dzisiejszy dzień?',
  'Co jutro zrobię lepiej?',
  'Co dało mi dziś najwięcej energii?',
  'Co mnie dziś martwiło i co mogę z tym zrobić?',
  'Co dziś było powodem do dumy?',
  'Jaki mały krok w stronę celu udało się dziś zrobić?',
  'Kto dziś poprawił mi humor?',
  'Co chcę zapamiętać z tego dnia?',
  'Na co dziś zabrakło czasu — i czy to naprawdę ważne?',
  'Co dziś warto było zrobić inaczej?',
  'Jaka myśl towarzyszyła mi dziś najczęściej?',
  'Za co mogę dziś pochwalić siebie?',
  'Co mnie dziś zaskoczyło?',
  'Co dziś było dobre dla mojego ciała i głowy?',
  'Trzy dobre rzeczy z dzisiaj:',
  'Co jutro jest najważniejsze?',
];

/** Pytanie dnia — stałe dla danej daty; `offset` przewija do kolejnych („Inne pytanie”). */
export function promptForDate(date: DateKey, offset = 0) {
  let seed = 0;
  for (const char of date) seed = (seed * 31 + char.charCodeAt(0)) % 100_003;
  return JOURNAL_PROMPTS[(seed + offset) % JOURNAL_PROMPTS.length];
}
