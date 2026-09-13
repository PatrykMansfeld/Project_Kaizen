import { useColorScheme } from 'react-native';

import { useThemePreferences } from './preferences';
import { buildTheme } from './theme';

/** Motyw z uwzględnieniem stylu, trybu jasny/ciemny (przez Appearance), koloru akcentu i czystej czerni. */
export function useTheme() {
  const { style, accent, amoled } = useThemePreferences();
  return buildTheme(style, useColorScheme() === 'dark', accent, amoled);
}
