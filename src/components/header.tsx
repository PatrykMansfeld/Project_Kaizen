import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { spacing } from '@/theme/theme';

/** Tekstowy przycisk w nagłówku ekranu, np. „Zapisz”. */
export function HeaderTextButton({
  label = 'Zapisz',
  onPress,
  disabled = false,
}: {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityState={{ disabled }}>
      <AppText variant="bodyStrong" tone={disabled ? 'textMuted' : 'accent'}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Kilka przycisków obok siebie w nagłówku. */
export function HeaderActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
