import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme } from './theme';

export function useTheme() {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}
