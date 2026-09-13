import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  /** 1–5 albo null (bez oceny). */
  value: number | null;
  onChange: (value: number | null) => void;
  size?: number;
};

/** Ocena gwiazdkami; stuknięcie w wybraną gwiazdkę kasuje ocenę. */
export function StarRating({ value, onChange, size = 36 }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: value ?? 0 }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value !== null && star <= value;
        return (
          <Pressable
            key={star}
            onPress={() => onChange(star === value ? null : star)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`Ocena ${star} z 5`}
            accessibilityState={{ selected: star === value }}>
            <Text style={[styles.star, { fontSize: size, lineHeight: size * 1.2, color: filled ? colors.warning : colors.textMuted }]}>
              {filled ? '★' : '☆'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  star: { textAlign: 'center' },
});
