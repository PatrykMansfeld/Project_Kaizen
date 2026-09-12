import Storage from 'expo-sqlite/kv-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { ACCENTS, type AccentKey } from './theme';

/**
 * Ustawienia wyglądu: tryb (systemowy / jasny / ciemny) i kolor akcentu. Trzymamy je w szybkim
 * magazynie klucz–wartość (odczyt synchroniczny), żeby motyw był znany od pierwszej klatki — jeszcze
 * zanim otworzy się główna baza.
 */

export type ThemeMode = 'system' | 'light' | 'dark';

const KEYS = { mode: 'kaizen.theme_mode', accent: 'kaizen.theme_accent' };

type Preferences = {
  mode: ThemeMode;
  accent: AccentKey;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentKey) => void;
};

const defaults: Preferences = { mode: 'system', accent: 'indigo', setMode: () => {}, setAccent: () => {} };
const PreferencesContext = createContext<Preferences>(defaults);

function readSetting<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = Storage.getItemSync(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Tryb jasny/ciemny ustawiamy dla całej aplikacji — wtedy także systemowe okna (np. Alert) go respektują. */
function applyMode(mode: ThemeMode) {
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}

export function ThemePreferencesProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readSetting(KEYS.mode, ['system', 'light', 'dark'], 'system'));
  const [accent, setAccentState] = useState<AccentKey>(() =>
    readSetting(KEYS.accent, Object.keys(ACCENTS) as AccentKey[], 'indigo'),
  );

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  const setMode = (next: ThemeMode) => {
    Storage.setItemSync(KEYS.mode, next);
    setModeState(next);
  };
  const setAccent = (next: AccentKey) => {
    Storage.setItemSync(KEYS.accent, next);
    setAccentState(next);
  };

  return (
    <PreferencesContext.Provider value={{ mode, accent, setMode, setAccent }}>{children}</PreferencesContext.Provider>
  );
}

export function useThemePreferences() {
  return useContext(PreferencesContext);
}
