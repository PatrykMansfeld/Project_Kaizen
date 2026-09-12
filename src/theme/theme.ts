const light = {
  background: '#F7F7F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F3',
  border: '#E4E4E9',
  text: '#1C2024',
  textSecondary: '#60646C',
  textMuted: '#8B8D98',
  accent: '#5B5BD6',
  accentSoft: '#E6E7FB',
  onAccent: '#FFFFFF',
  danger: '#E5484D',
  warning: '#F76B15',
  success: '#30A46C',
  // Kolory modułów — m.in. kropki w kalendarzu. Paleta (activity, habits, tasks, journal) sprawdzona
  // walidatorem pod kątem daltonizmu w obu trybach; zmieniając je, sprawdź ją ponownie.
  activity: '#F76B15',
  habits: '#30A46C',
  tasks: '#0090FF',
  journal: '#B04AA8',
  notes: '#E2A336',
  // Wydatki — osobny moduł (nie występuje razem z paletą kropek kalendarza).
  finance: '#0E8A7D',
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  background: '#111113',
  surface: '#19191B',
  surfaceAlt: '#232326',
  border: '#2E2E32',
  text: '#EDEEF0',
  textSecondary: '#B0B4BA',
  textMuted: '#7C7F87',
  accent: '#9EA0F5',
  accentSoft: '#2B2C5A',
  onAccent: '#111113',
  danger: '#FF6369',
  warning: '#FF8B3E',
  success: '#3DD68C',
  activity: '#D95926',
  habits: '#199E70',
  tasks: '#3987E5',
  journal: '#C957B8',
  notes: '#F5C451',
  finance: '#2EBFA9',
};

export type Theme = { dark: boolean; colors: ThemeColors };

/**
 * Kolory akcentu do wyboru w Ustawieniach: [akcent, tło akcentu] dla trybu jasnego i ciemnego.
 * Każdy akcent ma kontrast ≥ 4,5:1 jako tekst na tle aplikacji i pod napisem na przycisku.
 */
export const ACCENTS = {
  indigo: { label: 'Indygo', light: ['#5B5BD6', '#E6E7FB'], dark: ['#9EA0F5', '#2B2C5A'] },
  blue: { label: 'Niebieski', light: ['#0A6FBF', '#DCEBFB'], dark: ['#70B8FF', '#10304D'] },
  teal: { label: 'Morski', light: ['#0A7A69', '#D7F2EC'], dark: ['#3DD6B8', '#0E3A33'] },
  green: { label: 'Zielony', light: ['#1B7A52', '#DDF3E6'], dark: ['#4CC38A', '#123B27'] },
  orange: { label: 'Pomarańczowy', light: ['#B84600', '#FDE6D8'], dark: ['#FF9B5A', '#46260F'] },
  pink: { label: 'Różowy', light: ['#C2298A', '#FBE0F0'], dark: ['#F58ACC', '#48193A'] },
} as const;

export type AccentKey = keyof typeof ACCENTS;

export function withAccent(theme: Theme, accent: AccentKey): Theme {
  const [color, soft] = ACCENTS[accent][theme.dark ? 'dark' : 'light'];
  return { ...theme, colors: { ...theme.colors, accent: color, accentSoft: soft } };
}

export const lightTheme: Theme = { dark: false, colors: light };
export const darkTheme: Theme = { dark: true, colors: dark };

/** '#RRGGBB' + przezroczystość 0–1 → '#RRGGBBAA'. */
export function withAlpha(hex: string, alpha: number) {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;
