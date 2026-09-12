import { useColorScheme } from 'react-native';

import { useThemePreferences } from './preferences';
import { darkTheme, lightTheme, withAccent } from './theme';

/** Motyw z uwzględnieniem wybranego trybu (przez Appearance) i koloru akcentu. */
export function useTheme() {
  const { accent } = useThemePreferences();
  const base = useColorScheme() === 'dark' ? darkTheme : lightTheme;
  return withAccent(base, accent);
}
