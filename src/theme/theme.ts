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
  // Kolory modułów — m.in. kropki w kalendarzu.
  activity: '#F76B15',
  habits: '#30A46C',
  tasks: '#0090FF',
  journal: '#8E4EC6',
  notes: '#E2A336',
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
  activity: '#FF8B3E',
  habits: '#3DD68C',
  tasks: '#3B9EFF',
  journal: '#BF7AF0',
  notes: '#F5C451',
};

export type Theme = { dark: boolean; colors: ThemeColors };

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
