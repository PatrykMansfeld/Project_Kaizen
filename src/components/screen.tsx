import { Stack } from 'expo-router';
import { createContext, useContext, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/**
 * Ten sam ekran modułu może być zakładką (duży tytuł, bez paska nawigacji) albo ekranem otwartym
 * nad zakładkami (pasek z tytułem i strzałką wstecz). Tryb ustawia plik trasy — patrz TabScreenMode.
 */
type ScreenMode = 'tab' | 'stack';

const ScreenModeContext = createContext<ScreenMode>('stack');

/** Owija ekran modułu w pliku zakładki (app/(tabs)/…), żeby wyglądał jak zakładka. */
export function TabScreenMode({ children }: { children: ReactNode }) {
  return <ScreenModeContext.Provider value="tab">{children}</ScreenModeContext.Provider>;
}

type Props = {
  title: string;
  subtitle?: string;
  /** Akcje po prawej stronie nagłówka, np. przycisk dodawania. */
  headerRight?: ReactNode;
  children: ReactNode;
};

/**
 * Ekran modułu z listą (FlatList itp.) w środku. Jako zakładka: duży tytuł — dolny margines pod pasek
 * zakładek dodaje sam `NativeTabs`, tu pilnujemy tylko górnej krawędzi. Jako ekran stosu: tytuł w pasku
 * nawigacji, podtytuł nad treścią.
 */
export function Screen({ title, subtitle, headerRight, children }: Props) {
  const mode = useContext(ScreenModeContext);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (mode === 'stack') {
    return (
      <>
        <StackHeader title={title} headerRight={headerRight} />
        <View style={[styles.container, styles.stackContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
          {subtitle ? (
            <AppText tone="textSecondary" style={styles.stackSubtitle}>
              {subtitle}
            </AppText>
          ) : null}
          <View style={styles.content}>{children}</View>
        </View>
      </>
    );
  }

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

type ScrollScreenProps = {
  title: string;
  /** Przyciski po prawej stronie nagłówka. */
  headerRight?: ReactNode;
  children: ReactNode;
  /** Odstęp między elementami ekranu. */
  gap?: number;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Ekran z przewijaną treścią i marginesami — jako ekran stosu albo (w TabScreenMode) jako zakładka. */
export function ScrollScreen({ title, headerRight, children, gap = spacing.xl, contentStyle }: ScrollScreenProps) {
  const mode = useContext(ScreenModeContext);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (mode === 'tab') {
    return (
      <Screen title={title} headerRight={headerRight}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.tabScrollContent, { gap }, contentStyle]}>
          {children}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <>
      <StackHeader title={title} headerRight={headerRight} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.scrollContent, { gap, paddingBottom: insets.bottom + spacing.xl }, contentStyle]}>
        {children}
      </ScrollView>
    </>
  );
}

/** Tytuł i przyciski nagłówka stosu (dla ekranów z własną listą zamiast ScrollScreen). W zakładce nic nie robi. */
export function StackHeader({ title, headerRight }: { title: string; headerRight?: ReactNode }) {
  const mode = useContext(ScreenModeContext);
  if (mode === 'tab') return null;
  return <Stack.Screen options={{ title, headerRight: headerRight ? () => headerRight : undefined }} />;
}

/** Tło i marginesy listy (FlatList / SectionList) na ekranie stosu. */
export function useListScreenStyle() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return {
    style: { backgroundColor: colors.background },
    contentContainerStyle: [styles.listContent, { paddingBottom: insets.bottom + spacing.xl }],
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stackContainer: { paddingTop: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  titles: { flex: 1, gap: 2 },
  stackSubtitle: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  content: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  tabScrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  listContent: { flexGrow: 1, padding: spacing.lg },
});
