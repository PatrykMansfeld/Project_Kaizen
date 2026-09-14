import type { MediaItem } from '@/db/media';

/**
 * Ranking ulubionych z porównań parami („co lepsze?”) — punkty jak w szachach (Elo). Tytuł bez porównań
 * startuje z punktów wynikających z oceny, więc ranking od początku ma sens, a porównania go dopracowują.
 */

type Rankable = Pick<MediaItem, 'id' | 'elo' | 'rating' | 'duels' | 'finished_on'>;

/** Punkty z samej oceny: 10/10 → 1180, 1/10 → 820, bez oceny → 1000. */
export function seedElo(rating: number | null) {
  return 1000 + ((rating ?? 5.5) - 5.5) * 40;
}

export function eloOf(item: Pick<MediaItem, 'elo' | 'rating'>) {
  return item.elo ?? seedElo(item.rating);
}

const K = 32;

/** Nowe punkty po porównaniu: wygrana z faworytem daje więcej niż wygrana z outsiderem. */
export function duelResult(winner: number, loser: number) {
  const expected = 1 / (1 + 10 ** ((loser - winner) / 400));
  const change = K * (1 - expected);
  return { winner: winner + change, loser: loser - change };
}

/** Kolejność rankingu: punkty, potem ocena, potem data ukończenia. */
export function rankItems<T extends Rankable>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => eloOf(b) - eloOf(a) || (b.rating ?? 0) - (a.rating ?? 0) || (b.finished_on ?? '').localeCompare(a.finished_on ?? ''),
  );
}

/**
 * Następna para: tytuł porównywany najrzadziej i rywal o zbliżonej pozycji (losowo spośród trzech najbliższych,
 * żeby pary się nie powtarzały). Poprzednia para wraca tylko wtedy, gdy nie ma innej.
 */
export function pickDuel<T extends Rankable>(
  items: readonly T[],
  previous: readonly [number, number] | null,
  random = Math.random,
): [T, T] | null {
  if (items.length < 2) return null;
  const fewest = Math.min(...items.map((item) => item.duels));
  const candidates = items.filter((item) => item.duels === fewest);
  const first = candidates[Math.floor(random() * candidates.length)];
  const repeats = (id: number) => previous !== null && previous.includes(first.id) && previous.includes(id);
  const rivals = items
    .filter((item) => item.id !== first.id && !repeats(item.id))
    .sort((a, b) => Math.abs(eloOf(a) - eloOf(first)) - Math.abs(eloOf(b) - eloOf(first)))
    .slice(0, 3);
  if (rivals.length === 0) return [first, items.find((item) => item.id !== first.id)!];
  return [first, rivals[Math.floor(random() * rivals.length)]];
}
