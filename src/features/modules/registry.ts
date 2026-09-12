import type { Href } from 'expo-router';

import type { IconName } from '@/components/icon';
import type { DateKey } from '@/lib/dates';
import type { ThemeColors } from '@/theme/theme';

/** Moduły, które mogą być zakładką na dolnym pasku (każdy ma plik w app/(tabs) i trasę /modul/[key]). */
export const TAB_MODULES = [
  'nawyki',
  'zadania',
  'aktywnosc',
  'notatki',
  'finanse',
  'oplaty',
  'leki',
  'umiejetnosci',
  'dom',
  'statystyki',
  'moduly',
] as const;

export type TabModuleKey = (typeof TAB_MODULES)[number];

export type ModuleKey =
  | 'dzis'
  | TabModuleKey
  | 'dziennik'
  | 'cele'
  | 'podsumowanie'
  | 'przeglad'
  | 'sen'
  | 'pomiary'
  | 'cwiczenia'
  | 'projekty'
  | 'wnioski'
  | 'rok'
  | 'osiagniecia'
  | 'szukaj'
  | 'ustawienia';

export type ModuleGroup = 'Na co dzień' | 'Zdrowie i ciało' | 'Rozwój' | 'Finanse i dom' | 'Przegląd' | 'Aplikacja';

export type ModuleInfo = {
  key: ModuleKey;
  label: string;
  /** Krótszy podpis na pasku zakładek. */
  tabLabel?: string;
  icon: IconName;
  color: keyof ThemeColors;
  description: string;
  group: ModuleGroup;
  /** Ekran modułu (poza zakładkami); zakładki otwieramy przez /modul/[key]. */
  href?: (today: DateKey) => Href;
  /** Nie da się go ukryć. */
  required?: boolean;
};

export const MODULE_GROUPS: ModuleGroup[] = ['Na co dzień', 'Zdrowie i ciało', 'Rozwój', 'Finanse i dom', 'Przegląd', 'Aplikacja'];

export const MODULES: Record<ModuleKey, ModuleInfo> = {
  dzis: { key: 'dzis', label: 'Dziś', icon: 'today', color: 'accent', description: 'Kalendarz i plan dnia', group: 'Na co dzień', required: true },
  nawyki: { key: 'nawyki', label: 'Nawyki', icon: 'check_circle', color: 'habits', description: 'Odhaczanie i serie', group: 'Na co dzień' },
  zadania: { key: 'zadania', label: 'Zadania', icon: 'checklist', color: 'tasks', description: 'Lista rzeczy do zrobienia', group: 'Na co dzień' },
  notatki: { key: 'notatki', label: 'Notatki', icon: 'sticky_note_2', color: 'notes', description: 'Myśli, listy, zdjęcia', group: 'Na co dzień' },
  dziennik: {
    key: 'dziennik',
    label: 'Dziennik',
    icon: 'auto_stories',
    color: 'journal',
    description: 'Nastrój i wpis dnia',
    group: 'Na co dzień',
    href: (today) => ({ pathname: '/dziennik/[date]', params: { date: today } }),
  },
  cele: { key: 'cele', label: 'Cele', icon: 'sports_score', color: 'accent', description: 'Cele długoterminowe', group: 'Na co dzień', href: () => '/cele' },
  podsumowanie: {
    key: 'podsumowanie',
    label: 'Podsumowanie dnia',
    icon: 'nights_stay',
    color: 'accent',
    description: 'Domknięcie dnia w minutę',
    group: 'Na co dzień',
    href: () => '/podsumowanie',
  },
  przeglad: {
    key: 'przeglad',
    label: 'Przegląd tygodnia',
    icon: 'calendar_view_week',
    color: 'accent',
    description: 'Co wyszło, co poprawić',
    group: 'Na co dzień',
    href: () => '/przeglad-tygodnia',
  },
  aktywnosc: { key: 'aktywnosc', label: 'Aktywność', icon: 'directions_run', color: 'activity', description: 'Treningi', group: 'Zdrowie i ciało' },
  sen: {
    key: 'sen',
    label: 'Sen',
    icon: 'bedtime',
    color: 'accent',
    description: 'Długość i jakość snu',
    group: 'Zdrowie i ciało',
    href: (today) => ({ pathname: '/sen/[date]', params: { date: today } }),
  },
  leki: { key: 'leki', label: 'Leki i suplementy', tabLabel: 'Leki', icon: 'medication', color: 'danger', description: 'Dawki, przypomnienia, zapas', group: 'Zdrowie i ciało' },
  pomiary: { key: 'pomiary', label: 'Pomiary ciała', icon: 'monitor_weight', color: 'activity', description: 'Waga i obwody', group: 'Zdrowie i ciało', href: () => '/pomiary' },
  cwiczenia: {
    key: 'cwiczenia',
    label: 'Ćwiczenia i rekordy',
    icon: 'trending_up',
    color: 'activity',
    description: 'Postępy na siłowni',
    group: 'Zdrowie i ciało',
    href: () => '/cwiczenia',
  },
  umiejetnosci: {
    key: 'umiejetnosci',
    label: 'Umiejętności',
    tabLabel: 'Praktyka',
    icon: 'school',
    color: 'accent',
    description: 'Godziny praktyki',
    group: 'Rozwój',
  },
  projekty: { key: 'projekty', label: 'Projekty', icon: 'folder', color: 'tasks', description: 'Zadania w grupach', group: 'Rozwój', href: () => '/projekty' },
  finanse: { key: 'finanse', label: 'Wydatki', icon: 'payments', color: 'finance', description: 'Budżet i kategorie', group: 'Finanse i dom' },
  oplaty: { key: 'oplaty', label: 'Stałe opłaty', tabLabel: 'Opłaty', icon: 'event_repeat', color: 'finance', description: 'Rachunki i subskrypcje', group: 'Finanse i dom' },
  dom: { key: 'dom', label: 'Dom', icon: 'home', color: 'notes', description: 'Obowiązki, gwarancje, liczniki', group: 'Finanse i dom' },
  statystyki: { key: 'statystyki', label: 'Statystyki', icon: 'insights', color: 'accent', description: 'Tydzień i miesiąc w liczbach', group: 'Przegląd' },
  wnioski: { key: 'wnioski', label: 'Wnioski', icon: 'lightbulb', color: 'accent', description: 'Co ci pomaga', group: 'Przegląd', href: () => '/wnioski' },
  rok: { key: 'rok', label: 'Rok w pikselach', icon: 'calendar_view_month', color: 'accent', description: 'Cały rok na siatce', group: 'Przegląd', href: () => '/rok' },
  osiagniecia: {
    key: 'osiagniecia',
    label: 'Osiągnięcia',
    icon: 'emoji_events',
    color: 'accent',
    description: 'Odznaki',
    group: 'Przegląd',
    href: () => '/osiagniecia',
  },
  szukaj: { key: 'szukaj', label: 'Szukaj', icon: 'search', color: 'accent', description: 'We wszystkich modułach', group: 'Aplikacja', href: () => '/szukaj' },
  moduly: { key: 'moduly', label: 'Moduły', icon: 'apps', color: 'accent', description: 'Wszystkie moduły', group: 'Aplikacja', required: true },
  ustawienia: {
    key: 'ustawienia',
    label: 'Ustawienia',
    icon: 'settings',
    color: 'accent',
    description: 'Kopia, wygląd, blokada',
    group: 'Aplikacja',
    href: () => '/ustawienia',
    required: true,
  },
};

/** Trasy zakładek (gdy moduł jest na pasku). */
export const TAB_HREFS: Record<TabModuleKey, Href> = {
  nawyki: '/nawyki',
  zadania: '/zadania',
  aktywnosc: '/aktywnosc',
  notatki: '/notatki',
  finanse: '/finanse',
  oplaty: '/oplaty',
  leki: '/leki',
  umiejetnosci: '/umiejetnosci',
  dom: '/dom',
  statystyki: '/statystyki',
  moduly: '/moduly',
};

/** Najwięcej zakładek poza „Dziś” — Android pozwala na 5 zakładek w sumie. */
export const MAX_EXTRA_TABS = 4;

export const DEFAULT_TABS: TabModuleKey[] = ['nawyki', 'zadania', 'aktywnosc', 'notatki'];

export function isTabModule(key: string): key is TabModuleKey {
  return (TAB_MODULES as readonly string[]).includes(key);
}

/**
 * Porządkuje zapisane ustawienia: tylko znane moduły zakładek, bez powtórzeń i ukrytych, najwyżej 4.
 * Pusta lista jest dozwolona (zostaje sama zakładka „Dziś”).
 */
export function normalizeTabs(tabs: readonly string[], hidden: readonly string[]): TabModuleKey[] {
  const result: TabModuleKey[] = [];
  for (const key of tabs) {
    if ((TAB_MODULES as readonly string[]).includes(key) && !hidden.includes(key) && !result.includes(key as TabModuleKey)) {
      result.push(key as TabModuleKey);
    }
  }
  return result.slice(0, MAX_EXTRA_TABS);
}

export function normalizeHidden(hidden: readonly string[]): ModuleKey[] {
  return hidden.filter((key): key is ModuleKey => key in MODULES && !MODULES[key as ModuleKey].required);
}
