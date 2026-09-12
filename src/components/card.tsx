import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  children: ReactNode;
  /** Karta klikalna (z efektem stuknięcia). */
  onPress?: () => void;
  /** row — wiersz listy (ikona, treść, wartość w poziomie), inaczej karta z treścią w pionie. */
  variant?: 'card' | 'row';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Zaokrąglone tło w kolorze powierzchni — podstawa kart i wierszy list. */
export function Card({ children, onPress, variant = 'card', style, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const cardStyle = [variant === 'row' ? styles.row : styles.card, { backgroundColor: colors.surface }, style];

  if (!onPress) {
    return (
      <View style={cardStyle} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} android_ripple={{ color: colors.border }} accessibilityLabel={accessibilityLabel} style={cardStyle}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
