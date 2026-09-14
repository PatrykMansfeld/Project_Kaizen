import { Platform, type TextStyle } from 'react-native';

import { sakuraDark, sakuraLight, terminal, vaporDark, vaporLight, zenDark, zenLight } from './style-palettes';

const light = {
  background: '#F7F7F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F3',
  border: '#E4E4E9',
  text: '#1C2024',
  textSecondary: '#60646C',
  textMuted: '#696C76',
  accent: '#5B5BD6',
  accentSoft: '#E6E7FB',
  onAccent: '#FFFFFF',
  danger: '#C23A3F',
  warning: '#B34A00',
  success: '#1D7A4F',
  // Kolory modułów — m.in. kropki w kalendarzu. Paleta (activity, habits, tasks, journal) sprawdzona
  // walidatorem pod kątem daltonizmu w obu trybach; zmieniając je, sprawdź ją ponownie.
  activity: '#F76B15',
  habits: '#30A46C',
  tasks: '#0090FF',
  journal: '#B04AA8',
  notes: '#E2A336',
  // Wydatki — osobny moduł (nie występuje razem z paletą kropek kalendarza).
  finance: '#0E8A7D',
  // Pasek zakładek i nagłówki ekranów.
  chrome: '#FFFFFF',
  // Ramka kart; 'transparent' = karty bez ramki.
  cardBorder: 'transparent',
  // Dekoracje nagłówka zakładek (tylko style z ozdobami): vaporwave — słońce (decor → decorAlt) i siatka
  // (decorLine); zen — pieczątka (decorAlt) i pociągnięcie pędzla (decorLine).
  decor: '#FFFFFF',
  decorAlt: '#FFFFFF',
  decorLine: '#FFFFFF',
};

export type ThemeColors = typeof light;

const darkClassic: ThemeColors = {
  background: '#111113',
  surface: '#19191B',
  surfaceAlt: '#232326',
  border: '#2E2E32',
  text: '#EDEEF0',
  textSecondary: '#B0B4BA',
  textMuted: '#8B8E97',
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
  chrome: '#19191B',
  cardBorder: 'transparent',
  decor: '#19191B',
  decorAlt: '#19191B',
  decorLine: '#19191B',
};

export type ThemeStyle = 'classic' | 'vaporwave' | 'zen' | 'sakura' | 'terminal';

type StyleInfo = {
  label: string;
  description: string;
  /** Opis wersji jasnej i ciemnej (style z własną paletą zamiast koloru akcentu). */
  modes?: string;
  /** Styl ma tylko wersję ciemną (tryb jasny jest wtedy ignorowany). */
  darkOnly?: boolean;
};

export const THEME_STYLES: Record<ThemeStyle, StyleInfo> = {
  classic: { label: 'Klasyczny', description: 'Spokojny, z wybranym kolorem akcentu' },
  vaporwave: {
    label: 'Vaporwave',
    description: 'Pastelowy zachód w dzień, neon w nocy',
    modes: 'Vaporwave w trybie jasnym to pastelowy zachód, w ciemnym — neonowa noc.',
  },
  zen: {
    label: 'Zen',
    description: 'Papier, tusz i czerwona pieczęć',
    modes: 'Zen w trybie jasnym to papier washi i czerwona pieczęć, w ciemnym — tusz i złoto.',
  },
  sakura: {
    label: 'Sakura',
    description: 'Płatki wiśni i miękki krój',
    modes: 'Sakura w trybie jasnym to biel i płatki wiśni, w ciemnym — wiśniowa noc.',
  },
  terminal: {
    label: 'Terminal',
    description: 'Zielony fosfor na czarnym ekranie',
    modes: 'Terminal jest zawsze ciemny.',
    darkOnly: true,
  },
};

/** Krój tytułów i dużych liczb danego stylu z rozmiarami dobranymi do jego proporcji. */
export type DisplayFont = {
  family: string;
  title: TextStyle;
  heading: TextStyle;
  /** Rozmiar tytułu w pasku nawigacji ekranów stosu. */
  headerSize: number;
  /** Krój także dla zwykłego tekstu (terminal), nie tylko tytułów. */
  allText?: boolean;
};

export type Theme = {
  dark: boolean;
  style: ThemeStyle;
  colors: ThemeColors;
  /** Krój tytułów (null = systemowy). */
  display: DisplayFont | null;
  /** Grubość ramki kart (0 = bez ramki). */
  cardBorderWidth: number;
};

/** Czcionki stylów (ładowane w app/_layout.tsx; obie mają polskie znaki). */
export const VAPOR_FONT = 'VT323_400Regular';
export const ZEN_FONT = 'CormorantGaramond_600SemiBold';
export const SAKURA_FONT = 'Quicksand_700Bold';
/** Systemowy krój o stałej szerokości (na Androidzie z polskimi znakami) — bez pobierania. */
const MONO_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * Systemowy krój zwykłego tekstu, podawany zawsze jawnie. Bez niego Android potrafi zgubić tekst: po zmianie stylu
 * (tekst, który miał własny krój, traci go) albo na telefonach z własną czcionką systemową (OnePlus, Oppo, Xiaomi).
 */
export const SYSTEM_FONT = Platform.select({ ios: 'System', default: 'sans-serif' });

/** Krój zwykłego tekstu i pól w danym motywie (terminal — stała szerokość, reszta — systemowy). */
export function bodyFont(theme: Pick<Theme, 'display'>) {
  return theme.display?.allText ? theme.display.family : SYSTEM_FONT;
}

/** Krój pikselowy jest drobniejszy od systemowego — większe rozmiary i bez sztucznego pogrubienia. */
const VAPOR_DISPLAY: DisplayFont = {
  family: VAPOR_FONT,
  title: { fontSize: 42, lineHeight: 42, fontWeight: 'normal', letterSpacing: 1 },
  heading: { fontSize: 27, lineHeight: 28, fontWeight: 'normal', letterSpacing: 0.5 },
  headerSize: 26,
};

/** Garamond ma małe litery niższe od systemowych — nieco większy rozmiar, grubość z pliku (600). */
const ZEN_DISPLAY: DisplayFont = {
  family: ZEN_FONT,
  title: { fontSize: 36, lineHeight: 42, fontWeight: 'normal', letterSpacing: 0.3 },
  heading: { fontSize: 24, lineHeight: 29, fontWeight: 'normal', letterSpacing: 0.2 },
  headerSize: 24,
};

/** Quicksand jest zaokrąglony i lekki — grubość z pliku (700). */
const SAKURA_DISPLAY: DisplayFont = {
  family: SAKURA_FONT,
  title: { fontSize: 30, lineHeight: 38, fontWeight: 'normal' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: 'normal' },
  headerSize: 21,
};

/** Krój stałej szerokości jest szeroki — mniejsze tytuły; cały tekst w tym kroju. */
const TERMINAL_DISPLAY: DisplayFont = {
  family: MONO_FONT,
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: 0 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: 0 },
  headerSize: 18,
  allText: true,
};

/** Style z własną paletą: kolory obu wersji, krój tytułów i ramka kart. */
const STYLE_THEMES: Record<Exclude<ThemeStyle, 'classic'>, { light: ThemeColors; dark: ThemeColors; display: DisplayFont | null; cardBorderWidth: number }> = {
  vaporwave: { light: vaporLight, dark: vaporDark, display: VAPOR_DISPLAY, cardBorderWidth: 1.5 },
  zen: { light: zenLight, dark: zenDark, display: ZEN_DISPLAY, cardBorderWidth: 1 },
  sakura: { light: sakuraLight, dark: sakuraDark, display: SAKURA_DISPLAY, cardBorderWidth: 1 },
  terminal: { light: terminal, dark: terminal, display: TERMINAL_DISPLAY, cardBorderWidth: 1 },
};

/** Czysta czerń (AMOLED): tło i paski czarne, karty zostają lekko jaśniejsze. */
function withAmoled(colors: ThemeColors): ThemeColors {
  return { ...colors, background: '#000000', chrome: '#000000' };
}

/**
 * Kolory akcentu do wyboru w Ustawieniach (styl klasyczny): [akcent, tło akcentu] dla trybu jasnego i ciemnego.
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

/**
 * Pełny motyw: styl × tryb jasny/ciemny (× akcent w stylu klasycznym — pozostałe style mają własny)
 * × czysta czerń (tylko w trybie ciemnym).
 */
export function buildTheme(style: ThemeStyle, dark: boolean, accent: AccentKey, amoled = false): Theme {
  const isDark = dark || THEME_STYLES[style].darkOnly === true;
  let theme: Theme;
  if (style === 'classic') {
    const [color, soft] = ACCENTS[accent][isDark ? 'dark' : 'light'];
    theme = {
      dark: isDark,
      style,
      colors: { ...(isDark ? darkClassic : light), accent: color, accentSoft: soft },
      display: null,
      cardBorderWidth: 0,
    };
  } else {
    const entry = STYLE_THEMES[style];
    theme = { dark: isDark, style, colors: isDark ? entry.dark : entry.light, display: entry.display, cardBorderWidth: entry.cardBorderWidth };
  }
  return isDark && amoled ? { ...theme, colors: withAmoled(theme.colors) } : theme;
}

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
