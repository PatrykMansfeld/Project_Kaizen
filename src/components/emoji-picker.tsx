import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = { options: readonly string[]; value: string; onChange: (emoji: string) => void; color: string };

/** Siatka emoji do wyboru (ikona nawyku, kategorii); wybrana ma tło i ramkę w kolorze. */
export function EmojiPicker({ options, value, onChange, color }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      {options.map((emoji) => {
        const selected = value === emoji;
        return (
          <Pressable
            key={emoji}
            onPress={() => onChange(emoji)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.option,
              { backgroundColor: selected ? withAlpha(color, 0.25) : colors.surface },
              selected && { borderColor: color },
            ]}>
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
});
