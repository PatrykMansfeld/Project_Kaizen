import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  /** Kolor ikony, gdy chip nie jest wybrany. */
  iconColor?: string;
};

export function Chip({ label, selected, onPress, icon, iconColor }: Props) {
  const { colors } = useTheme();
  const foreground = selected ? colors.onAccent : colors.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      android_ripple={{ color: colors.border }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
      {icon ? <Icon name={icon} size={18} color={selected ? foreground : (iconColor ?? foreground)} /> : null}
      <AppText variant="caption" style={[styles.label, { color: foreground }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Chipy obok siebie: zawijane do kolejnych linii albo (scroll) w jednym przewijanym rzędzie. */
export function ChipRow({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
        {children}
      </ScrollView>
    );
  }
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  scrollRow: { gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  label: { fontWeight: '600' },
});
