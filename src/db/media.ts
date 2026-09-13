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
  /** Ocena 1–5 albo null. */
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
  created_at: string;
};

export type MediaInput = Omit<MediaItem, 'id' | 'created_at'>;

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
  };
}

export function createMediaItem(db: SQLiteDatabase, input: MediaInput) {
  return db.runAsync(
    `INSERT INTO media_items (kind, title, creator, status, rating, platform, release_year, season, episode, total, started_on, finished_on, note, cover_uri)
     VALUES ($kind, $title, $creator, $status, $rating, $platform, $year, $season, $episode, $total, $started, $finished, $note, $cover)`,
    toParams(input),
  );
}

export function updateMediaItem(db: SQLiteDatabase, id: number, input: MediaInput) {
  return db.runAsync(
    `UPDATE media_items SET kind = $kind, title = $title, creator = $creator, status = $status, rating = $rating,
       platform = $platform, release_year = $year, season = $season, episode = $episode, total = $total,
       started_on = $started, finished_on = $finished, note = $note, cover_uri = $cover
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
 * +1 odcinek (serial, anime — bez ustawionego sezonu zaczynamy od 1.) albo +1 rozdział mangi
 * (tom jest opcjonalny — wiele osób liczy tylko rozdziały).
 */
export function nextEpisode(db: SQLiteDatabase, id: number) {
  return db.runAsync(
    `UPDATE media_items SET
       season = CASE WHEN kind IN ('series', 'anime') THEN COALESCE(season, 1) ELSE season END,
       episode = COALESCE(episode, 0) + 1
     WHERE id = ?`,
    id,
  );
}

/** Bieżąca strona książki (nie dalej niż liczba stron, jeśli jest znana). */
export function setBookPage(db: SQLiteDatabase, id: number, page: number) {
  return db.runAsync('UPDATE media_items SET episode = CASE WHEN total IS NOT NULL AND ? > total THEN total ELSE ? END WHERE id = ?', page, page, id);
}
