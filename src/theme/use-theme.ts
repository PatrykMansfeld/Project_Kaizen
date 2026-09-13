import { useColorScheme } from 'react-native';

import { useThemePreferences } from './preferences';
import { buildTheme } from './theme';

/** Motyw z uwzględnieniem stylu, trybu jasny/ciemny (przez Appearance) i koloru akcentu. */
export function useTheme() {
  const { style, accent } = useThemePreferences();
  return buildTheme(style, useColorScheme() === 'dark', accent);
}
