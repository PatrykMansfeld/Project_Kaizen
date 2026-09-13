import type { MediaInput, MediaItem, MediaKind, MediaStatus } from '@/db/media';
import type { DateKey } from '@/lib/dates';
import { formatDecimal, plural } from '@/lib/format';

/** Jak liczymy postęp: odcinki (sezon + odcinek), rozdziały (tom + rozdział), strony albo wcale. */
export type MediaProgress = 'episodes' | 'chapters' | 'pages' | null;

type KindInfo = {
  label: string;
  /** Liczba mnoga do filtrów. */
  plural: string;
  /** Odmiana do liczników: „1 film”, „2 filmy”, „5 filmów”. */
  counts: [string, string, string];
  emoji: string;
  /** Przykładowy tytuł w polu edycji. */
  example: string;
  /** Nagłówek i podpowiedzi „gdzie / na czym / w jakiej formie”. */
  platformLabel: string;
  platforms: string[];
  /** Podpis pola autora (null = rodzaj bez autora). */
  creatorLabel: string | null;
  progress: MediaProgress;
  /** Podpisy statusów (rodzaj gramatyczny: film, gra, anime…). */
  statuses: Record<MediaStatus, string>;
  /** Chip „ukończone” na liście. */
  finishLabel: string;
};

const WATCHED = { planned: 'Na liście', active: 'Oglądam', done: 'Obejrzany', dropped: 'Porzucony' };
const READ = { planned: 'Na liście', active: 'Czytam', done: 'Przeczytana', dropped: 'Porzucona' };
const STREAMING = ['Netflix', 'HBO Max', 'Disney+', 'Prime Video'];

/** Rodzaje w kolejności filtrów: najpierw do oglądania, potem do czytania, na końcu gry. */
export const MEDIA_KINDS: Record<MediaKind, KindInfo> = {
  movie: {
    label: 'Film',
    plural: 'Filmy',
    counts: ['film', 'filmy', 'filmów'],
    emoji: '🎬',
    example: 'np. Diuna: Część druga',
    platformLabel: 'Gdzie',
    platforms: ['Kino', ...STREAMING, 'TV'],
    creatorLabel: null,
    progress: null,
    statuses: WATCHED,
    finishLabel: 'Obejrzane',
  },
  series: {
    label: 'Serial',
    plural: 'Seriale',
    counts: ['serial', 'seriale', 'seriali'],
    emoji: '📺',
    example: 'np. Rojst',
    platformLabel: 'Gdzie',
    platforms: [...STREAMING, 'Apple TV+', 'TV'],
    creatorLabel: null,
    progress: 'episodes',
    statuses: WATCHED,
    finishLabel: 'Obejrzane',
  },
  anime: {
    label: 'Anime',
    plural: 'Anime',
    counts: ['anime', 'anime', 'anime'],
    emoji: '🍥',
    example: 'np. Frieren',
    platformLabel: 'Gdzie',
    platforms: ['Crunchyroll', 'Netflix', 'Disney+', 'Prime Video'],
    creatorLabel: null,
    progress: 'episodes',
    statuses: { planned: 'Na liście', active: 'Oglądam', done: 'Obejrzane', dropped: 'Porzucone' },
    finishLabel: 'Obejrzane',
  },
  book: {
    label: 'Książka',
    plural: 'Książki',
    counts: ['książka', 'książki', 'książek'],
    emoji: '📖',
    example: 'np. Lalka',
    platformLabel: 'W jakiej formie',
    platforms: ['Papier', 'E-book', 'Audiobook', 'Legimi', 'Storytel', 'Biblioteka'],
    creatorLabel: 'Autor',
    progress: 'pages',
    statuses: READ,
    finishLabel: 'Przeczytane',
  },
  manga: {
    label: 'Manga',
    plural: 'Mangi',
    counts: ['manga', 'mangi', 'mang'],
    emoji: '💬',
    example: 'np. Berserk',
    platformLabel: 'W jakiej formie',
    platforms: ['Tomiki', 'Online', 'Manga Plus', 'E-book'],
    creatorLabel: 'Autor',
    progress: 'chapters',
    statuses: READ,
    finishLabel: 'Przeczytane',
  },
  game: {
    label: 'Gra',
    plural: 'Gry',
    counts: ['gra', 'gry', 'gier'],
    emoji: '🎮',
    example: 'np. Wiedźmin 3',
    platformLabel: 'Na czym',
    platforms: ['PC', 'PS5', 'Xbox', 'Switch', 'Telefon'],
    creatorLabel: null,
    progress: null,
    statuses: { planned: 'Na liście', active: 'Gram', done: 'Ukończona', dropped: 'Porzucona' },
    finishLabel: 'Ukończone',
  },
};

export const MEDIA_KIND_KEYS = Object.keys(MEDIA_KINDS) as MediaKind[];

export const MEDIA_STATUSES: MediaStatus[] = ['planned', 'active', 'done', 'dropped'];

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === 'string' && value in MEDIA_KINDS;
}

/** Ocena gwiazdkami: 4 → „★★★★☆”. */
export function stars(rating: number) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

type ProgressFields = Pick<MediaItem, 'kind' | 'season' | 'episode' | 'total'>;

/** Ułamek przeczytanej książki (0–1) albo null, gdy nie ma czego liczyć. */
export function bookProgress(item: ProgressFields) {
  if (MEDIA_KINDS[item.kind].progress !== 'pages' || !item.total || !item.episode) return null;
  return Math.min(1, item.episode / item.total);
}

/** Postęp w jednej linii: „S2 · odc. 5”, „tom 3 · rozdz. 25”, „s. 120 z 350 · 34%”; null — nic do pokazania. */
export function progressLabel(item: ProgressFields) {
  switch (MEDIA_KINDS[item.kind].progress) {
    case 'episodes':
      if (item.season === null) return null;
      return item.episode ? `S${item.season} · odc. ${item.episode}` : `Sezon ${item.season}`;
    case 'chapters': {
      const parts = [item.season ? `tom ${item.season}` : null, item.episode ? `rozdz. ${item.episode}` : null].filter(Boolean);
      return parts.length ? parts.join(' · ') : null;
    }
    case 'pages': {
      const fraction = bookProgress(item);
      if (item.episode && fraction !== null) return `s. ${item.episode} z ${item.total} · ${Math.round(fraction * 100)}%`;
      if (item.episode) return `s. ${item.episode}`;
      return item.total ? plural(item.total, ['strona', 'strony', 'stron']) : null;
    }
    default:
      return null;
  }
}

/**
 * Porządkuje dane przed zapisem: daty zgodne ze statusem (ukończone mają datę końca, lista „do obejrzenia”
 * nie ma dat), postęp i autor tylko tam, gdzie pasują do rodzaju.
 */
export function normalizeMedia(input: MediaInput, today: DateKey): MediaInput {
  const info = MEDIA_KINDS[input.kind];
  const finished = input.status === 'done' ? (input.finished_on ?? today) : null;
  let { season, episode, total } = input;
  switch (info.progress) {
    case 'episodes':
      // Odcinek ma sens tylko w sezonie.
      episode = season !== null ? episode : null;
      total = null;
      break;
    case 'chapters':
      total = null;
      break;
    case 'pages':
      season = null;
      if (total !== null && episode !== null && episode > total) episode = total;
      break;
    default:
      season = episode = total = null;
  }
  return {
    ...input,
    title: input.title.trim(),
    creator: info.creatorLabel ? input.creator.trim() : '',
    platform: input.platform.trim(),
    note: input.note.trim(),
    season,
    episode,
    total,
    started_on: input.status === 'planned' ? null : (input.started_on ?? finished ?? today),
    finished_on: finished,
  };
}

export type MediaYearStats = {
  counts: Record<MediaKind, number>;
  total: number;
  /** Średnia z ocenionych albo null. */
  averageRating: number | null;
  /** Najwyżej oceniony (przy remisie — ostatnio ukończony). */
  best: MediaItem | null;
};

/** Ukończone w danym roku: ile czego, średnia ocena i najlepszy tytuł. */
export function mediaYearStats(items: readonly MediaItem[], year: number): MediaYearStats {
  const prefix = `${year}-`;
  const done = items.filter((item) => item.status === 'done' && item.finished_on?.startsWith(prefix));
  const counts = Object.fromEntries(MEDIA_KIND_KEYS.map((kind) => [kind, 0])) as Record<MediaKind, number>;
  for (const item of done) counts[item.kind]++;
  const rated = done.filter((item) => item.rating !== null);
  const best = [...rated].sort((a, b) => b.rating! - a.rating! || (b.finished_on ?? '').localeCompare(a.finished_on ?? ''))[0] ?? null;
  return {
    counts,
    total: done.length,
    averageRating: rated.length ? rated.reduce((sum, item) => sum + item.rating!, 0) / rated.length : null,
    best,
  };
}

/** „4,3 ★” */
export function formatRating(value: number) {
  return `${formatDecimal(value, 1)} ★`;
}

/** Losowy tytuł z listy — inny niż poprzednio wylosowany, jeśli jest z czego wybierać. */
export function pickRandom<T extends { id: number }>(items: readonly T[], previousId: number | null, random = Math.random): T | null {
  const pool = items.length > 1 ? items.filter((item) => item.id !== previousId) : items;
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length)];
}
