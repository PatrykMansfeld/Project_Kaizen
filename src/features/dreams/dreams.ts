import type { Dream, DreamCategory } from '@/db/dreams';

export const DREAM_CATEGORIES: Record<DreamCategory, { label: string; emoji: string; example: string }> = {
  travel: { label: 'Podróże', emoji: '✈️', example: 'np. Zobaczyć zorzę polarną' },
  adventure: { label: 'Przygody', emoji: '🪂', example: 'np. Skok ze spadochronem' },
  skill: { label: 'Umiejętności', emoji: '🎓', example: 'np. Nauczyć się grać na gitarze' },
  create: { label: 'Tworzenie', emoji: '🎨', example: 'np. Napisać książkę' },
  people: { label: 'Ludzie', emoji: '🤝', example: 'np. Zabrać rodziców do Włoch' },
  things: { label: 'Rzeczy', emoji: '🎁', example: 'np. Własny ogród' },
  other: { label: 'Inne', emoji: '✨', example: 'np. Przebiec maraton' },
};

export const DREAM_CATEGORY_KEYS = Object.keys(DREAM_CATEGORIES) as DreamCategory[];

export function isDreamCategory(value: unknown): value is DreamCategory {
  return typeof value === 'string' && value in DREAM_CATEGORIES;
}

export const DREAM_ICONS = [
  '✨', '✈️', '🌍', '🗻', '🏝️', '🌌', '🪂', '🏄', '🚀', '🏃', '🚴', '⛵',
  '🎓', '🎸', '🎹', '🗣️', '🎨', '📚', '✍️', '📷', '🤝', '❤️', '👨‍👩‍👧', '🏡',
  '🌱', '🐶', '🚗', '🎁', '🍷', '🎤', '🏆', '🧘',
];

export type DreamsSummary = { total: number; done: number; doneThisYear: number };

export function dreamsSummary(dreams: readonly Pick<Dream, 'done_on'>[], year: number): DreamsSummary {
  const done = dreams.filter((dream) => dream.done_on !== null);
  return {
    total: dreams.length,
    done: done.length,
    doneThisYear: done.filter((dream) => dream.done_on!.startsWith(`${year}-`)).length,
  };
}

/** Podpis roku: „do 2027”, „planowane na 2024” (rok minął), „w tym roku”. */
export function targetLabel(targetYear: number | null, currentYear: number) {
  if (targetYear === null) return null;
  if (targetYear === currentYear) return 'w tym roku';
  if (targetYear < currentYear) return `planowane na ${targetYear}`;
  return `do ${targetYear}`;
}
