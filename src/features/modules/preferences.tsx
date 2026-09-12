import { router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { useToday } from '@/lib/use-today';

import {
  DEFAULT_TABS,
  MODULES,
  TAB_HREFS,
  isTabModule,
  normalizeHidden,
  normalizeTabs,
  type ModuleKey,
  type TabModuleKey,
} from './registry';

/**
 * Układ modułów: które są zakładkami na dolnym pasku (poza „Dziś”) i które są ukryte.
 * Jak ustawienia wyglądu — w szybkim magazynie klucz–wartość, żeby pasek był znany od pierwszej klatki.
 */

const KEYS = { tabs: 'kaizen.tabs', hidden: 'kaizen.hidden_modules' };

type ModulePreferences = {
  tabs: TabModuleKey[];
  hidden: ModuleKey[];
  save: (tabs: TabModuleKey[], hidden: ModuleKey[]) => void;
};

const ModulePreferencesContext = createContext<ModulePreferences>({ tabs: DEFAULT_TABS, hidden: [], save: () => {} });

function readList(key: string): string[] | null {
  try {
    const value = Storage.getItemSync(key);
    const parsed: unknown = value ? JSON.parse(value) : null;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : null;
  } catch {
    return null;
  }
}

function initial() {
  const hidden = normalizeHidden(readList(KEYS.hidden) ?? []);
  return { tabs: normalizeTabs(readList(KEYS.tabs) ?? DEFAULT_TABS, hidden), hidden };
}

export function ModulePreferencesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initial);

  const save = (tabs: TabModuleKey[], hidden: ModuleKey[]) => {
    const cleanHidden = normalizeHidden(hidden);
    const cleanTabs = normalizeTabs(tabs, cleanHidden);
    Storage.setItemSync(KEYS.tabs, JSON.stringify(cleanTabs));
    Storage.setItemSync(KEYS.hidden, JSON.stringify(cleanHidden));
    setState({ tabs: cleanTabs, hidden: cleanHidden });
  };

  return <ModulePreferencesContext.Provider value={{ ...state, save }}>{children}</ModulePreferencesContext.Provider>;
}

export function useModulePreferences() {
  return useContext(ModulePreferencesContext);
}

/** Czy moduł jest widoczny (nieukryty) — ukryte znikają ze skrótów, statystyk i ekranu Moduły. */
export function useModuleVisible(key: ModuleKey) {
  return !useModulePreferences().hidden.includes(key);
}

/**
 * Otwiera moduł: zakładkę, jeśli jest na pasku, a inaczej ekran nad zakładkami.
 * (Ukrytej zakładki nie da się otworzyć — dlatego każdy moduł ma też trasę /modul/[key].)
 */
export function useOpenModule() {
  const { tabs } = useModulePreferences();
  const today = useToday();

  return (key: ModuleKey) => {
    if (key === 'dzis') {
      router.navigate('/');
      return;
    }
    if (isTabModule(key)) {
      if (tabs.includes(key)) router.navigate(TAB_HREFS[key]);
      else router.push({ pathname: '/modul/[key]', params: { key } });
      return;
    }
    const href = MODULES[key].href;
    if (href) router.push(href(today));
  };
}
