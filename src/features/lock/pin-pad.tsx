import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Liczba kropek do pokazania (np. długość zapisanego PIN-u). */
  length: number;
  /** Przycisk w lewym dolnym rogu (np. odcisk palca). */
  extra?: ReactNode;
  error?: string | null;
};

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

/** Kropki PIN-u i klawiatura numeryczna. */
export function PinPad({ value, onChange, length, extra, error }: Props) {
  const { colors } = useTheme();

  const press = (digit: string) => {
    if (value.length < length) onChange(value + digit);
  };

  return (
    <View style={styles.container}>
      <View style={styles.dots} accessibilityLabel={`Wpisano ${value.length} z ${length} cyfr`}>
        {Array.from({ length }, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { borderColor: error ? colors.danger : colors.textSecondary },
              index < value.length && { backgroundColor: error ? colors.danger : colors.text },
            ]}
          />
        ))}
      </View>
      <AppText variant="caption" tone="danger" style={styles.error}>
        {error ?? ' '}
      </AppText>

      {ROWS.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((digit) => (
            <Key key={digit} onPress={() => press(digit)} label={digit} />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.key}>{extra}</View>
        <Key onPress={() => press('0')} label="0" />
        <Key onPress={() => onChange(value.slice(0, -1))} accessibilityLabel="Usuń cyfrę">
          <Icon name="backspace" size={26} color={colors.text} />
        </Key>
      </View>
    </View>
  );
}

function Key({
  onPress,
  label,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      android_ripple={{ color: colors.border, borderless: true }}
      style={[styles.key, label ? { backgroundColor: colors.surfaceAlt } : null]}>
      {label ? <AppText style={styles.digit}>{label}</AppText> : children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.md },
  dots: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.xs },
  dot: { width: 14, height: 14, borderRadius: radius.full, borderWidth: 1.5 },
  error: { minHeight: 18 },
  row: { flexDirection: 'row', gap: spacing.xl },
  key: { width: 72, height: 72, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: 28, lineHeight: 34, fontWeight: '500' },
});
