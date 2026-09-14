import { Children, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Wysokie okno (np. lista do przewijania) — zajmuje prawie cały ekran. */
  tall?: boolean;
  /** Odstęp między elementami okna. */
  gap?: number;
};

/**
 * Okno wysuwane od dołu, zamykane stuknięciem w tło albo przyciskiem wstecz.
 * Zawartość montuje się przy każdym otwarciu, więc jej stan startuje od nowa.
 */
export function BottomSheet({ visible, onClose, children, tall = false, gap = spacing.lg }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      {visible ? (
        <>
          <Pressable style={[styles.backdrop, tall && styles.tallBackdrop]} onPress={onClose} accessibilityLabel="Zamknij" />
          <View
            style={[
              styles.sheet,
              tall ? styles.tallSheet : styles.regularSheet,
              { gap, backgroundColor: colors.surface, paddingBottom: insets.bottom + (tall ? 0 : spacing.lg) },
            ]}>
            {children}
          </View>
        </>
      ) : null}
    </Modal>
  );
}

/** Rząd przycisków na dole okna — każdy zajmuje równą część szerokości. */
export function SheetActions({ children }: { children: ReactNode }) {
  return (
    <View style={styles.actions}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={styles.action}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** Nagłówek okna: tytuł (najwyżej 2 linie), opcjonalny podpis i przycisk zamknięcia. */
export function SheetTitle({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose?: () => void }) {
  return (
    <View style={styles.title}>
      <View style={styles.titleRow}>
        <AppText variant="heading" numberOfLines={2} style={styles.flex}>
          {title}
        </AppText>
        {onClose ? <IconButton icon="close" accessibilityLabel="Zamknij" onPress={onClose} /> : null}
      </View>
      {subtitle ? <AppText tone="textSecondary">{subtitle}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  tallBackdrop: { flex: 0, height: '15%' },
  sheet: {
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  regularSheet: { paddingTop: spacing.xl },
  tallSheet: { flex: 1, paddingTop: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
  title: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
