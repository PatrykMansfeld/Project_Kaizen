import { StyleSheet, Text, type TextProps } from 'react-native';

import type { ThemeColors } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

export type AppTextProps = TextProps & {
  variant?: keyof typeof styles;
  /** Kolor z motywu. */
  tone?: keyof ThemeColors;
};

export function AppText({ variant = 'body', tone = 'text', style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return <Text style={[styles[variant], { color: colors[tone] }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
});
