import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  title: string;
  /** Podpis albo element pod tytułem (np. „Ten tydzień” lub chip „Wróć do dziś”). */
  subtitle?: ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  /** Gdy false, strzałka w przód jest wyszarzona (np. nie ma przyszłych tygodni). */
  canGoNext?: boolean;
  /** Np. „dzień”, „tydzień” — do opisów strzałek dla czytnika ekranu. */
  unitLabel: { previous: string; next: string };
  /** Mniejszy tytuł (długie nazwy dni). */
  compact?: boolean;
};

/** ‹ tytuł okresu › — przełączanie dni, tygodni, miesięcy albo lat. */
export function PeriodNavigator({ title, subtitle, onPrevious, onNext, canGoNext = true, unitLabel, compact = false }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <IconButton icon="chevron_left" accessibilityLabel={unitLabel.previous} onPress={onPrevious} />
      <View style={styles.center}>
        <AppText variant={compact ? 'bodyStrong' : 'heading'} style={styles.title}>
          {title}
        </AppText>
        {typeof subtitle === 'string' ? (
          <AppText variant="caption" tone="textSecondary">
            {subtitle}
          </AppText>
        ) : (
          subtitle
        )}
      </View>
      <IconButton
        icon="chevron_right"
        accessibilityLabel={unitLabel.next}
        color={canGoNext ? colors.text : colors.border}
        onPress={() => canGoNext && onNext()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', gap: spacing.xs },
  title: { textAlign: 'center' },
});
