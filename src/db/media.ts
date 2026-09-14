import type { SQLiteDatabase } from 'expo-sqlite';

import type { DateKey } from '@/lib/dates';

export type MediaKind = 'movie' | 'series' | 'anime' | 'book' | 'manga' | 'game';

export type MediaStatus = 'planned' | 'active' | 'done' | 'dropped';

export type MediaItem = {
  id: number;
  kind: MediaKind;
  title: string;
  /** Autor (książka, manga). */
  creator: string;
  status: MediaStatus;
  /** Ocena 1–10 albo null. */
  rating: number | null;
  platform: string;
  release_year: number | null;
  /**
   * Postęp: serial i anime — sezon i ostatni obejrzany odcinek; manga — tom i ostatni rozdział;
   * książka — bieżąca strona (episode) z `total` stron.
   */
  season: number | null;
  episode: number | null;
  /** Liczba stron książki. */
  total: number | null;
  started_on: DateKey | null;
  finished_on: DateKey | null;
  note: string;
  /** Okładka (plik w katalogu aplikacji) albo null. */
  cover_uri: string | null;
  /** Długość filmu albo jednego odcinka (serial, anime), w minutach. */
  length_min: number | null;
  /** Obejrzane odcinki łącznie, ze wszystkich sezonów (serial, anime). */
  episodes_seen: number | null;
  /** Czas gry w minutach. */
  played_min: number | null;
  /** Gatunki po przecinku: „Sci-fi, Dramat” (features/media/media.ts: parseGenres). */
  genres: string;
  /** Ranking z porównań parami (Elo); null — jeszcze nieporównywany. */
  elo: number | null;
  /** Ile razy tytuł był porównywany. */
  duels: number;
  created_at: string;
};

/** Pola z edycji tytułu (ranking zmieniają tylko porównania). */
export type MediaInput = Omit<MediaItem, 'id' | 'created_at' | 'elo' | 'duels'>;

/** Ukończone od najnowszego, reszta od najnowiej dodanej. */
export const MEDIA_SQL = 'SELECT * FROM media_items ORDER BY finished_on DESC, id DESC';

export function getMediaItem(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<MediaItem>('SELECT * FROM media_items WHERE id = ?', id);
}

function toParams(input: MediaInput) {
  return {
    $kind: input.kind,
    $title: input.title,
    $creator: input.creator,
    $status: input.status,
    $rating: input.rating,
    $platform: input.platform,
    $year: input.release_year,
    $season: input.season,
    $episode: input.episode,
    $total: input.total,
    $started: input.started_on,
    $finished: input.finished_on,
    $note: input.note,
    $cover: input.cover_uri ?? null,
    $length: input.length_min ?? null,
    $seen: input.episodes_seen ?? null,
    $played: input.played_min ?? null,
    $genres: input.genres ?? '',
  };
}

export function createMediaItem(db: SQLiteDatabase, input: MediaInput) {
  return db.runAsync(
    `INSERT INTO media_items (kind, title, creator, status, rating, platform, release_year, season, episode, total, started_on,
       finished_on, note, cover_uri, length_min, episodes_seen, played_min, genres)
     VALUES ($kind, $title, $creator, $status, $rating, $platform, $year, $season, $episode, $total, $started,
       $finished, $note, $cover, $length, $seen, $played, $genres)`,
    toParams(input),
  );
}

export function updateMediaItem(db: SQLiteDatabase, id: number, input: MediaInput) {
  return db.runAsync(
    `UPDATE media_items SET kind = $kind, title = $title, creator = $creator, status = $status, rating = $rating,
       platform = $platform, release_year = $year, season = $season, episode = $episode, total = $total,
       started_on = $started, finished_on = $finished, note = $note, cover_uri = $cover, length_min = $length,
       episodes_seen = $seen, played_min = $played, genres = $genres
     WHERE id = $id`,
    { ...toParams(input), $id: id },
  );
}

export function deleteMediaItem(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM media_items WHERE id = ?', id);
}

/** Zaczynam oglądać / grać (data startu tylko przy pierwszym razie). */
export function startMediaItem(db: SQLiteDatabase, id: number, today: DateKey) {
  return db.runAsync(
    "UPDATE media_items SET status = 'active', started_on = COALESCE(started_on, ?), finished_on = NULL WHERE id = ?",
    today,
    id,
  );
}

/** Ukończone — z oceną (albo bez); przeczytana książka jest na ostatniej stronie. */
export function finishMediaItem(db: SQLiteDatabase, id: number, rating: number | null, date: DateKey) {
  return db.runAsync(
    `UPDATE media_items SET status = 'done', rating = ?, finished_on = ?, started_on = COALESCE(started_on, ?),
       episode = CASE WHEN kind = 'book' AND total IS NOT NULL THEN total ELSE episode END
     WHERE id = ?`,
    rating,
    date,
    date,
    id,
  );
}

/**
 * +1 odcinek (serial, anime — bez ustawionego sezonu zaczynamy od 1.; rośnie też licznik obejrzanych łącznie)
 * albo +1 rozdział mangi (tom jest opcjonalny — wiele osób liczy tylko rozdziały).
 */
export function nextEpisode(db: SQLiteDatabase, id: number) {
  return db.runAsync(
    `UPDATE media_items SET
       season = CASE WHEN kind IN ('series', 'anime') THEN COALESCE(season, 1) ELSE season END,
       episode = COALESCE(episode, 0) + 1,
       episodes_seen = CASE WHEN kind IN ('series', 'anime') THEN COALESCE(episodes_seen, 0) + 1 ELSE episodes_seen END
     WHERE id = ?`,
    id,
  );
}

/** Dolicza czas gry (np. „+1 h”). */
export function addPlayTime(db: SQLiteDatabase, id: number, minutes: number) {
  return db.runAsync('UPDATE media_items SET played_min = COALESCE(played_min, 0) + ? WHERE id = ?', minutes, id);
}

/** Wynik porównania parami: nowe punkty rankingu obu tytułów (liczone w features/media/ranking.ts). */
export function saveDuel(db: SQLiteDatabase, winner: { id: number; elo: number }, loser: { id: number; elo: number }) {
  return db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE media_items SET elo = ?, duels = duels + 1 WHERE id = ?', winner.elo, winner.id);
    await db.runAsync('UPDATE media_items SET elo = ?, duels = duels + 1 WHERE id = ?', loser.elo, loser.id);
  });
}

/** Ranking rodzaju od nowa (porównania znikają, kolejność znów wynika z ocen). */
export function resetRanking(db: SQLiteDatabase, kind: MediaKind) {
  return db.runAsync('UPDATE media_items SET elo = NULL, duels = 0 WHERE kind = ?', kind);
}

/** Bieżąca strona książki (nie dalej niż liczba stron, jeśli jest znana). */
export function setBookPage(db: SQLiteDatabase, id: number, page: number) {
  return db.runAsync('UPDATE media_items SET episode = CASE WHEN total IS NOT NULL AND ? > total THEN total ELSE ? END WHERE id = ?', page, page, id);
}
