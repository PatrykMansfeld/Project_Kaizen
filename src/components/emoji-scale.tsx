import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

export type EmojiOption = { value: number; emoji: string; label: string };

type Props = {
  options: readonly EmojiOption[];
  value: number | null;
  /** Ponowne stuknięcie w wybraną opcję ją odznacza (null). */
  onChange: (value: number | null) => void;
  color: string;
  /** Przygaszanie niewybranych opcji, gdy coś jest wybrane. */
  dimUnselected?: boolean;
};

/** Skala 1–5 z emoji, np. nastrój albo jakość snu. */
export function EmojiScale({ options, value, onChange, color, dimUnselected = false }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(selected ? null : option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={[
              styles.option,
              selected
                ? { backgroundColor: withAlpha(color, 0.18), borderColor: color }
                : { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
            <Text style={[styles.emoji, dimUnselected && value !== null && !selected && styles.dimmed]}>{option.emoji}</Text>
            <AppText variant="caption" tone={selected ? 'text' : 'textSecondary'} numberOfLines={1}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  emoji: { fontSize: 28 },
  dimmed: { opacity: 0.45 },
});
