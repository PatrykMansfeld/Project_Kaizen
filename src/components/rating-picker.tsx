import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Props = {
  /** 1–10 albo null (bez oceny). */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Opis słowny oceny (indeks = ocena), np. RATING_LABELS z Kultury. */
  labels?: readonly string[];
};

/**
 * Ocena 1–10: rząd dziesięciu pól — wybrane i niższe są wypełnione jak pasek, pod spodem ocena z opisem.
 * Stuknięcie w wybraną liczbę kasuje ocenę.
 */
export function RatingPicker({ value, onChange, labels }: Props) {
  const { colors } = useTheme();
  const label = value !== null ? labels?.[value] : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {SCORES.map((score) => {
          const filled = value !== null && score <= value;
          const selected = score === value;
          return (
            <Pressable
              key={score}
              onPress={() => onChange(selected ? null : score)}
              accessibilityRole="button"
              accessibilityLabel={`Ocena ${score} z 10${labels?.[score] ? `, ${labels[score]}` : ''}`}
              accessibilityState={{ selected }}
              style={[styles.cell, { backgroundColor: filled ? colors.accent : colors.surfaceAlt }]}>
              <AppText
                variant={selected ? 'bodyStrong' : 'caption'}
                style={{ color: filled ? colors.onAccent : colors.textSecondary }}>
                {score}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" tone={value !== null ? 'text' : 'textMuted'}>
        {value !== null
          ? `${value}/10${label ? ` · ${label}` : ''}`
          : 'Bez oceny — stuknij liczbę. Stuknięcie w wybraną ją kasuje.'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
