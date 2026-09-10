import { addDays, type DateKey } from '@/lib/dates';

export const HABIT_COLORS = {
  green: { label: 'Zielony', light: '#30A46C', dark: '#3DD68C' },
  teal: { label: 'Morski', light: '#12A594', dark: '#0BD8B6' },
  blue: { label: 'Niebieski', light: '#0090FF', dark: '#3B9EFF' },
  indigo: { label: 'Indygo', light: '#3E63DD', dark: '#849DFF' },
  purple: { label: 'Fioletowy', light: '#8E4EC6', dark: '#BF7AF0' },
  pink: { label: 'Różowy', light: '#D6409F', dark: '#F76AC8' },
  red: { label: 'Czerwony', light: '#E5484D', dark: '#FF6369' },
  orange: { label: 'Pomarańczowy', light: '#F76B15', dark: '#FF8B3E' },
  yellow: { label: 'Żółty', light: '#C99A0A', dark: '#F5C451' },
} as const;

export type HabitColorKey = keyof typeof HABIT_COLORS;

export const HABIT_COLOR_KEYS = Object.keys(HABIT_COLORS) as HabitColorKey[];

export function habitColor(key: string, dark: boolean) {
  const color = HABIT_COLORS[key as HabitColorKey] ?? HABIT_COLORS.green;
  return dark ? color.dark : color.light;
}

export const HABIT_ICONS = [
  '💧', '🏃', '🚶', '🚴', '🏊', '💪', '🧘', '📚',
  '✍️', '🧠', '🎯', '💻', '🎸', '🎨', '🌱', '☀️',
  '😴', '🛏️', '🦷', '🚿', '💊', '🍎', '🥗', '🥛',
  '☕', '🚭', '📵', '🧹', '🙏', '❤️', '🐶', '💰',
];

/**
 * Seria: kolejne dni z osiągniętym celem, licząc wstecz od dziś.
 * Jeśli dziś jeszcze nie odhaczone, seria trwa dalej i liczymy od wczoraj.
 */
export function currentStreak(doneDays: Set<DateKey>, today: DateKey) {
  let day = doneDays.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (doneDays.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function formatStreak(days: number) {
  return `🔥 ${days} ${days === 1 ? 'dzień' : 'dni'}`;
}
