import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/theme/use-theme';

export type IconName = AndroidSymbol;

/** Ikona Material Symbols (https://fonts.google.com/icons), np. `<Icon name="add" />`. */
export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: ColorValue }) {
  const { colors } = useTheme();
  return <SymbolView name={{ android: name, web: name }} size={size} tintColor={color ?? colors.text} />;
}
