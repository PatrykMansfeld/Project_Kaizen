import Storage from 'expo-sqlite/kv-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { ACCENTS, THEME_STYLES, type AccentKey, type ThemeStyle } from './theme';

/**
 * Ustawienia wyglądu: styl (klasyczny / vaporwave), tryb (systemowy / jasny / ciemny) i kolor akcentu. Trzymamy je w szybkim
 * magazynie klucz–wartość (odczyt synchroniczny), żeby motyw był znany od pierwszej klatki — jeszcze
 * zanim otworzy się główna baza.
 */

export type ThemeMode = 'system' | 'light' | 'dark';

const KEYS = { mode: 'kaizen.theme_mode', accent: 'kaizen.theme_accent', style: 'kaizen.theme_style', amoled: 'kaizen.theme_amoled' };

type Preferences = {
  mode: ThemeMode;
  accent: AccentKey;
  style: ThemeStyle;
  /** Czysta czerń w trybie ciemnym (ekrany AMOLED). */
  amoled: boolean;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentKey) => void;
  setStyle: (style: ThemeStyle) => void;
  setAmoled: (amoled: boolean) => void;
};

const defaults: Preferences = {
  mode: 'system',
  accent: 'indigo',
  style: 'classic',
  amoled: false,
  setMode: () => {},
  setAccent: () => {},
  setStyle: () => {},
  setAmoled: () => {},
};
const PreferencesContext = createContext<Preferences>(defaults);

function readSetting<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = Storage.getItemSync(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Tryb jasny/ciemny ustawiamy dla całej aplikacji — wtedy także systemowe okna (np. Alert) go respektują.
 * Styl tylko ciemny (terminal) wymusza ciemny niezależnie od wyboru.
 */
function applyMode(mode: ThemeMode, style: ThemeStyle) {
  if (THEME_STYLES[style].darkOnly) Appearance.setColorScheme('dark');
  else Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}

export function ThemePreferencesProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readSetting(KEYS.mode, ['system', 'light', 'dark'], 'system'));
  const [accent, setAccentState] = useState<AccentKey>(() =>
    readSetting(KEYS.accent, Object.keys(ACCENTS) as AccentKey[], 'indigo'),
  );
  const [style, setStyleState] = useState<ThemeStyle>(() =>
    readSetting(KEYS.style, Object.keys(THEME_STYLES) as ThemeStyle[], 'classic'),
  );

  const [amoled, setAmoledState] = useState(() => readSetting(KEYS.amoled, ['1', '0'], '0') === '1');

  useEffect(() => {
    applyMode(mode, style);
  }, [mode, style]);

  const setMode = (next: ThemeMode) => {
    Storage.setItemSync(KEYS.mode, next);
    setModeState(next);
  };
  const setAccent = (next: AccentKey) => {
    Storage.setItemSync(KEYS.accent, next);
    setAccentState(next);
  };
  const setStyle = (next: ThemeStyle) => {
    Storage.setItemSync(KEYS.style, next);
    setStyleState(next);
  };
  const setAmoled = (next: boolean) => {
    Storage.setItemSync(KEYS.amoled, next ? '1' : '0');
    setAmoledState(next);
  };

  return (
    <PreferencesContext.Provider value={{ mode, accent, style, amoled, setMode, setAccent, setStyle, setAmoled }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function useThemePreferences() {
  return useContext(PreferencesContext);
}
