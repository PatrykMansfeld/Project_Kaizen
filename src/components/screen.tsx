import { Stack } from 'expo-router';
import { createContext, useContext, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { SakuraBlossom, SakuraBranch, TerminalCursor, TerminalPrompt, TerminalRule } from '@/components/style-decor';
import { VaporGrid, VaporSun } from '@/components/vapor-decor';
import { ZenBrush, ZenSeal } from '@/components/zen-decor';
import { SYSTEM_FONT, spacing, type Theme, type ThemeStyle } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/**
 * Ten sam ekran modułu może być zakładką (duży tytuł, bez paska nawigacji) albo ekranem otwartym
 * nad zakładkami (pasek z tytułem i strzałką wstecz). Tryb ustawia plik trasy — patrz TabScreenMode.
 */
type ScreenMode = 'tab' | 'stack';

type HeaderDecor = {
  /** Za tytułem (pod przyciskami, bez interakcji). */
  behind?: () => ReactNode;
  /** Tuż przed tekstem tytułu. */
  beforeTitle?: () => ReactNode;
  /** Tuż za tekstem tytułu. */
  afterTitle?: () => ReactNode;
  /** Pas pod nagłówkiem. */
  below: () => ReactNode;
};

/** Ozdoby nagłówka zakładki (styl klasyczny ich nie ma). */
const HEADER_DECOR: Partial<Record<ThemeStyle, HeaderDecor>> = {
  vaporwave: { behind: VaporSun, below: VaporGrid },
  zen: { afterTitle: ZenSeal, below: ZenBrush },
  sakura: { afterTitle: SakuraBlossom, below: SakuraBranch },
  terminal: { beforeTitle: TerminalPrompt, afterTitle: TerminalCursor, below: TerminalRule },
};

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
  const { colors, style } = useTheme();
  const decor = HEADER_DECOR[style];
  // Vaporwave ma nagłówek w kolorze paska; pozostałe style — w kolorze tła.
  const headerColor = style === 'vaporwave' ? colors.chrome : colors.background;
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
          {/* Po zmianie stylu treść powstaje od nowa — Android potrafi nie przerysować starych widoków. */}
          <View key={style} style={styles.content}>
            {children}
          </View>
        </View>
      </>
    );
  }

  // Vaporwave: za tytułem zachodzące słońce, pod spodem siatka; zen: pieczątka przy tytule i pociągnięcie pędzla;
  // sakura: kwiat i gałązka; terminal: „>” i migający kursor.
  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: headerColor }]}>
      <View style={[styles.header, { backgroundColor: headerColor }]}>
        {decor?.behind ? <decor.behind /> : null}
        <View style={styles.titles}>
          <View style={styles.titleRow}>
            {decor?.beforeTitle ? <decor.beforeTitle /> : null}
            <AppText variant="title" style={styles.titleText}>
              {title}
            </AppText>
            {decor?.afterTitle ? <decor.afterTitle /> : null}
          </View>
          {subtitle ? <AppText tone="textSecondary">{subtitle}</AppText> : null}
        </View>
        {headerRight}
      </View>
      {decor ? <decor.below /> : null}
      <View key={style} style={[styles.content, { backgroundColor: colors.background }]}>
        {children}
      </View>
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
  const { colors, style } = useTheme();
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
        key={style}
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
  const theme = useTheme();
  if (mode === 'tab') return null;
  // Kolory i krój nagłówka ustawia każdy ekran przy każdym renderze — sam motyw nawigacji nie zawsze
  // przerysowuje nagłówek już otwartego ekranu po zmianie stylu.
  return (
    <Stack.Screen options={{ title, headerRight: headerRight ? () => headerRight : undefined, ...headerOptions(theme) }} />
  );
}

/** Wygląd paska nawigacji w danym motywie: tło, kolor strzałki i tytułu, krój tytułu. */
export function headerOptions(theme: Theme) {
  return {
    headerStyle: { backgroundColor: theme.colors.chrome },
    headerTintColor: theme.colors.text,
    headerTitleStyle: theme.display
      ? { fontFamily: theme.display.family, fontSize: theme.display.headerSize, color: theme.colors.text }
      : { fontFamily: SYSTEM_FONT, color: theme.colors.text },
  };
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
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  titles: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleText: { flexShrink: 1 },
  stackSubtitle: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  content: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  tabScrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  listContent: { flexGrow: 1, padding: spacing.lg },
});
