import { StyleSheet, Text, type TextProps } from 'react-native';

import { bodyFont, type ThemeColors } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

export type AppTextProps = TextProps & {
  variant?: keyof typeof styles;
  /** Kolor z motywu. */
  tone?: keyof ThemeColors;
};

/** Warianty pisane krojem tytułowym stylu (VT323 w vaporwave, Garamond w zen, Quicksand w sakurze) — z rozmiarami z motywu. */
const DISPLAY_VARIANTS = ['title', 'heading'] as const;

export function AppText({ variant = 'body', tone = 'text', style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const { colors, display } = theme;
  const displayVariant = display ? DISPLAY_VARIANTS.find((name) => name === variant) : undefined;
  return (
    <Text
      // Po zmianie stylu tekst powstaje od nowa — Android potrafi zostawić stary krój albo pomiar i tekst znika.
      key={theme.style}
      style={[
        styles[variant],
        display && displayVariant ? [display[displayVariant], { fontFamily: display.family }] : { fontFamily: bodyFont(theme) },
        { color: colors[tone] },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
});
