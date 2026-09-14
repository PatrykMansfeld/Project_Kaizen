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
  /** Podpowiedzi gatunków w edycji (można dopisać własne). */
  genres: string[];
};

const WATCHED = { planned: 'Na liście', active: 'Oglądam', done: 'Obejrzany', dropped: 'Porzucony' };
const READ = { planned: 'Na liście', active: 'Czytam', done: 'Przeczytana', dropped: 'Porzucona' };
const STREAMING = ['Netflix', 'HBO Max', 'Disney+', 'Prime Video'];
const SCREEN_GENRES = [
  'Akcja', 'Komedia', 'Dramat', 'Sci-fi', 'Fantasy', 'Horror', 'Thriller', 'Kryminał', 'Romans', 'Przygodowy',
  'Historyczny', 'Animacja', 'Dokument',
];
const ANIME_GENRES = [
  'Shōnen', 'Seinen', 'Shōjo', 'Isekai', 'Slice of life', 'Mecha', 'Akcja', 'Komedia', 'Dramat', 'Fantasy',
  'Sci-fi', 'Romans', 'Horror', 'Sportowe',
];
const BOOK_GENRES = [
  'Fantasy', 'Sci-fi', 'Kryminał', 'Thriller', 'Romans', 'Literatura piękna', 'Klasyka', 'Reportaż',
  'Biografia', 'Historia', 'Poradnik', 'Horror', 'Popularnonaukowa',
];
const MANGA_GENRES = [
  'Shōnen', 'Seinen', 'Shōjo', 'Isekai', 'Slice of life', 'Akcja', 'Fantasy', 'Romans', 'Horror', 'Komedia',
  'Sportowa',
];
const GAME_GENRES = [
  'RPG', 'Akcja', 'Przygodowa', 'Otwarty świat', 'Strategia', 'Strzelanka', 'Platformówka', 'Roguelike',
  'Logiczna', 'Wyścigi', 'Sportowa', 'Symulator', 'Horror', 'Indie',
];

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
    genres: SCREEN_GENRES,
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
    genres: SCREEN_GENRES,
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
    genres: ANIME_GENRES,
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
    genres: BOOK_GENRES,
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
    genres: MANGA_GENRES,
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
    genres: GAME_GENRES,
  },
};

export const MEDIA_KIND_KEYS = Object.keys(MEDIA_KINDS) as MediaKind[];

export const MEDIA_STATUSES: MediaStatus[] = ['planned', 'active', 'done', 'dropped'];

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === 'string' && value in MEDIA_KINDS;
}

/** Ocena w skali 1–10 z opisem słownym (indeks = ocena). */
export const RATING_LABELS = [
  '',
  'Nieporozumienie',
  'Bardzo słabe',
  'Słabe',
  'Ujdzie',
  'Średnie',
  'Niezłe',
  'Dobre',
  'Bardzo dobre',
  'Rewelacyjne',
  'Arcydzieło',
];

/** Ocena tytułu: 8 → „8/10”. */
export function formatScore(rating: number) {
  return `${Math.max(1, Math.min(10, Math.round(rating)))}/10`;
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
  const watched = info.progress === 'episodes';
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
    // Czas: długość filmu albo odcinka, odcinki obejrzane łącznie (serial, anime), czas gry.
    length_min: input.kind === 'movie' || watched ? positive(input.length_min) : null,
    episodes_seen: watched ? (input.episodes_seen ?? null) : null,
    played_min: input.kind === 'game' ? (input.played_min ?? null) : null,
    genres: formatGenres(parseGenres(input.genres ?? '')),
  };
}

function positive(value: number | null | undefined) {
  return value && value > 0 ? value : null;
}

/** „Sci-fi, dramat ,Sci-fi” → ['Sci-fi', 'dramat'] (bez pustych i powtórzeń, wielkość liter bez znaczenia). */
export function parseGenres(text: string): string[] {
  const result: string[] = [];
  for (const part of text.split(',')) {
    const genre = part.trim().replace(/\s+/g, ' ');
    if (genre && !result.some((existing) => existing.toLowerCase() === genre.toLowerCase())) result.push(genre);
  }
  return result;
}

export function formatGenres(genres: readonly string[]) {
  return genres.map((genre) => genre.replace(/,/g, ' ').trim()).filter(Boolean).join(', ');
}

/** Włącza albo wyłącza gatunek w tekście z bazy. */
export function toggleGenre(text: string, genre: string) {
  const genres = parseGenres(text);
  const has = genres.some((existing) => existing.toLowerCase() === genre.toLowerCase());
  return formatGenres(has ? genres.filter((existing) => existing.toLowerCase() !== genre.toLowerCase()) : [...genres, genre]);
}

type TimeFields = Pick<MediaItem, 'kind' | 'status' | 'length_min' | 'episodes_seen' | 'played_min'>;

/**
 * Czas spędzony z tytułem w minutach: obejrzany film, odcinki × długość odcinka, czas gry.
 * Książek i mang nie liczymy w czasie (mają strony i rozdziały).
 */
export function timeSpent(item: TimeFields) {
  switch (item.kind) {
    case 'movie':
      return item.status === 'done' ? (item.length_min ?? 0) : 0;
    case 'series':
    case 'anime':
      return (item.episodes_seen ?? 0) * (item.length_min ?? 0);
    case 'game':
      return item.played_min ?? 0;
    default:
      return 0;
  }
}

/** 45 → „45 min”, 150 → „2,5 h”, 8460 → „141 h”. */
export function formatTimeSpent(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return `${hours < 10 ? formatDecimal(hours, 1) : Math.round(hours)} h`;
}

export type GenreStat = { genre: string; count: number; rated: number; average: number | null };

/** Gatunki tytułów: ile razy, ile ocenionych i średnia ocena; od najczęstszego. */
export function genreStats(items: readonly MediaItem[]): GenreStat[] {
  const byGenre = new Map<string, { genre: string; count: number; ratings: number[] }>();
  for (const item of items) {
    for (const genre of parseGenres(item.genres)) {
      const key = genre.toLowerCase();
      const entry = byGenre.get(key) ?? { genre, count: 0, ratings: [] };
      entry.count++;
      if (item.rating !== null) entry.ratings.push(item.rating);
      byGenre.set(key, entry);
    }
  }
  return [...byGenre.values()]
    .map(({ genre, count, ratings }) => ({
      genre,
      count,
      rated: ratings.length,
      average: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null,
    }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre, 'pl'));
}

/** Najwyżej oceniany gatunek (z co najmniej dwoma ocenionymi tytułami). */
export function favoriteGenre(stats: readonly GenreStat[]): GenreStat | null {
  return stats.filter((stat) => stat.rated >= 2).sort((a, b) => b.average! - a.average! || b.count - a.count)[0] ?? null;
}

export type MediaYearStats = {
  counts: Record<MediaKind, number>;
  total: number;
  /** Średnia z ocenionych albo null. */
  averageRating: number | null;
  /** Najwyżej oceniony (przy remisie — ostatnio ukończony). */
  best: MediaItem | null;
  /** Czas z tytułów ukończonych w tym roku (minuty). */
  minutes: number;
};

function doneInYear(items: readonly MediaItem[], year: number) {
  const prefix = `${year}-`;
  return items.filter((item) => item.status === 'done' && item.finished_on?.startsWith(prefix));
}

function byRating(a: MediaItem, b: MediaItem) {
  return (b.rating ?? 0) - (a.rating ?? 0) || (b.finished_on ?? '').localeCompare(a.finished_on ?? '');
}

/** Ukończone w danym roku: ile czego, średnia ocena, najlepszy tytuł i czas. */
export function mediaYearStats(items: readonly MediaItem[], year: number): MediaYearStats {
  const done = doneInYear(items, year);
  const counts = Object.fromEntries(MEDIA_KIND_KEYS.map((kind) => [kind, 0])) as Record<MediaKind, number>;
  for (const item of done) counts[item.kind]++;
  const rated = done.filter((item) => item.rating !== null);
  return {
    counts,
    total: done.length,
    averageRating: rated.length ? rated.reduce((sum, item) => sum + item.rating!, 0) / rated.length : null,
    best: [...rated].sort(byRating)[0] ?? null,
    minutes: done.reduce((sum, item) => sum + timeSpent(item), 0),
  };
}

export type MediaYearReport = MediaYearStats & {
  done: MediaItem[];
  minutesByKind: Record<MediaKind, number>;
  /** Czas z tytułów w trakcie — tylko dla bieżącego roku. */
  activeMinutes: number;
  pages: number;
  chapters: number;
  /** Ukończone w kolejnych miesiącach (0 = styczeń). */
  months: number[];
  bestMonth: { month: number; count: number } | null;
  /** Najwyżej ocenione, najwyżej 5. */
  top: MediaItem[];
  /** Ile tytułów dostało daną ocenę (indeks = ocena 1–10). */
  ratings: number[];
  genres: GenreStat[];
  favoriteGenre: GenreStat | null;
  /** Tytuł, z którym spędzono najwięcej czasu. */
  longest: { item: MediaItem; minutes: number } | null;
};

/** Rok w kulturze: wszystko o tytułach ukończonych w danym roku. */
export function mediaYearReport(items: readonly MediaItem[], year: number, currentYear: number): MediaYearReport {
  const stats = mediaYearStats(items, year);
  const done = doneInYear(items, year).sort((a, b) => (a.finished_on ?? '').localeCompare(b.finished_on ?? ''));
  const minutesByKind = Object.fromEntries(MEDIA_KIND_KEYS.map((kind) => [kind, 0])) as Record<MediaKind, number>;
  const months = Array.from({ length: 12 }, () => 0);
  const ratings = Array.from({ length: 11 }, () => 0);
  let pages = 0;
  let chapters = 0;
  let longest: MediaYearReport['longest'] = null;
  for (const item of done) {
    const minutes = timeSpent(item);
    minutesByKind[item.kind] += minutes;
    if (minutes > 0 && (!longest || minutes > longest.minutes)) longest = { item, minutes };
    months[Number(item.finished_on!.slice(5, 7)) - 1]++;
    if (item.rating !== null) ratings[item.rating]++;
    if (item.kind === 'book') pages += item.total ?? item.episode ?? 0;
    if (item.kind === 'manga') chapters += item.episode ?? 0;
  }
  const peak = Math.max(...months);
  const genres = genreStats(done);
  return {
    ...stats,
    done,
    minutesByKind,
    activeMinutes:
      year === currentYear ? items.filter((item) => item.status === 'active').reduce((sum, item) => sum + timeSpent(item), 0) : 0,
    pages,
    chapters,
    months,
    bestMonth: peak > 0 ? { month: months.indexOf(peak), count: peak } : null,
    top: done.filter((item) => item.rating !== null).sort(byRating).slice(0, 5),
    ratings,
    genres,
    favoriteGenre: favoriteGenre(genres),
    longest,
  };
}

/** Lata, w których coś ukończono (od najnowszego), zawsze z bieżącym. */
export function mediaYears(items: readonly MediaItem[], currentYear: number) {
  const years = new Set([currentYear]);
  for (const item of items) if (item.status === 'done' && item.finished_on) years.add(Number(item.finished_on.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

/** Średnia ocena: „7,4/10”. */
export function formatRating(value: number) {
  return `${formatDecimal(value, 1)}/10`;
}

/** Losowy tytuł z listy — inny niż poprzednio wylosowany, jeśli jest z czego wybierać. */
export function pickRandom<T extends { id: number }>(items: readonly T[], previousId: number | null, random = Math.random): T | null {
  const pool = items.length > 1 ? items.filter((item) => item.id !== previousId) : items;
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length)];
}
