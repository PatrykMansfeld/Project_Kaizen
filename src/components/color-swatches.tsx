import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { radius, spacing } from '@/theme/theme';

export type Swatch<K extends string> = { key: K; label: string; color: string };

type Props<K extends string> = {
  swatches: Swatch<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Kolor znaczka ✓ na wybranej próbce. */
  checkColor: string;
  size?: number;
};

/** Okrągłe próbki kolorów do wyboru (kolor nawyku, akcent aplikacji). */
export function ColorSwatches<K extends string>({ swatches, value, onChange, checkColor, size = 36 }: Props<K>) {
  return (
    <View style={styles.row}>
      {swatches.map((swatch) => {
        const selected = value === swatch.key;
        return (
          <Pressable
            key={swatch.key}
            onPress={() => onChange(swatch.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={swatch.label}
            style={[styles.swatch, { width: size, height: size, backgroundColor: swatch.color }]}>
            {selected ? <Icon name="check" size={20} color={checkColor} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
