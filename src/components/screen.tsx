import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  title: string;
  subtitle?: string;
  /** Akcje po prawej stronie nagłówka, np. przycisk dodawania. */
  headerRight?: ReactNode;
  children: ReactNode;
};

/**
 * Ekran zakładki z dużym tytułem. Dolny margines pod pasek zakładek dodaje sam `NativeTabs`,
 * tu pilnujemy tylko górnej krawędzi (pasek statusu).
 */
export function Screen({ title, subtitle, headerRight, children }: Props) {
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <AppText variant="title">{title}</AppText>
          {subtitle ? <AppText tone="textSecondary">{subtitle}</AppText> : null}
        </View>
        {headerRight}
      </View>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  titles: { flex: 1, gap: 2 },
  content: { flex: 1 },
});
