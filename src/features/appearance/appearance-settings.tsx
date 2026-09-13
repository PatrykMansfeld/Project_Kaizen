import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Chip, ChipRow } from '@/components/chip';
import { ColorSwatches } from '@/components/color-swatches';
import { useThemePreferences, type ThemeMode } from '@/theme/preferences';
import { ACCENTS, THEME_STYLES, buildTheme, radius, spacing, type AccentKey, type ThemeColors, type ThemeStyle } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const MODES: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'Jak w telefonie' },
  { mode: 'light', label: 'Jasny' },
  { mode: 'dark', label: 'Ciemny' },
];

const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];
const STYLE_KEYS = Object.keys(THEME_STYLES) as ThemeStyle[];

/** Sekcja „Wygląd” w Ustawieniach: styl, tryb jasny/ciemny, czysta czerń i (w stylu klasycznym) kolor akcentu. */
export function AppearanceSettings() {
  const { dark, colors } = useTheme();
  const { mode, accent, style, amoled, setMode, setAccent, setStyle, setAmoled } = useThemePreferences();

  return (
    <View style={styles.container}>
      <AppText variant="label" tone="textSecondary">
        Styl
      </AppText>
      <View style={styles.styles}>
        {STYLE_KEYS.map((key) => (
          <StyleOption key={key} styleKey={key} accent={accent} selected={style === key} onPress={() => setStyle(key)} />
        ))}
      </View>

      <AppText variant="label" tone="textSecondary">
        Tryb
      </AppText>
      <ChipRow>
        {MODES.map((option) => (
          <Chip key={option.mode} label={option.label} selected={mode === option.mode} onPress={() => setMode(option.mode)} />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip label="Czysta czerń (AMOLED)" icon="contrast" selected={amoled} onPress={() => setAmoled(!amoled)} />
      </ChipRow>
      <AppText variant="caption" tone="textMuted">
        {amoled
          ? 'W trybie ciemnym tło i paski są czarne — na ekranach OLED to mniej zużytej baterii.'
          : 'Czarne tło w trybie ciemnym zamiast grafitowego — dobre dla ekranów OLED.'}
      </AppText>
      {THEME_STYLES[style].modes ? (
        <AppText variant="caption" tone="textMuted">
          {THEME_STYLES[style].modes}
        </AppText>
      ) : (
        <>
          <AppText variant="label" tone="textSecondary">
            Kolor akcentu
          </AppText>
          <ColorSwatches
            swatches={ACCENT_KEYS.map((key) => ({ key, label: ACCENTS[key].label, color: ACCENTS[key][dark ? 'dark' : 'light'][0] }))}
            value={accent}
            onChange={setAccent}
            checkColor={colors.onAccent}
            size={40}
          />
        </>
      )}
    </View>
  );
}

type StyleOptionProps = { styleKey: ThemeStyle; accent: AccentKey; selected: boolean; onPress: () => void };

/** Wiersz stylu z podglądem obu wersji (jasnej i ciemnej). */
function StyleOption({ styleKey, accent, selected, onPress }: StyleOptionProps) {
  const { colors } = useTheme();
  const info = THEME_STYLES[styleKey];
  // Styl tylko ciemny ma jeden podgląd na całą szerokość.
  const previews = info.darkOnly ? [buildTheme(styleKey, true, accent)] : [buildTheme(styleKey, false, accent), buildTheme(styleKey, true, accent)];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${info.label}: ${info.description}`}
      style={[styles.option, { borderColor: selected ? colors.accent : colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.previews}>
        {previews.map((preview) => (
          <View key={String(preview.dark)} style={[styles.preview, { backgroundColor: preview.colors.background }]}>
            <View style={[styles.previewBar, { backgroundColor: styleKey === 'vaporwave' ? preview.colors.chrome : preview.colors.background }]}>
              <PreviewMark styleKey={styleKey} colors={preview.colors} />
            </View>
            <View
              style={[
                styles.previewCard,
                { backgroundColor: preview.colors.surface, borderColor: preview.colors.cardBorder, borderWidth: preview.cardBorderWidth ? 1 : 0 },
              ]}>
              <View style={[styles.previewLine, { backgroundColor: preview.colors.accent }]} />
              <View style={[styles.previewLine, styles.previewShort, { backgroundColor: preview.colors.habits }]} />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.optionText}>
        <AppText variant="bodyStrong" style={styleNameFont(previews[0].display?.family)}>
          {info.label}
        </AppText>
        <AppText variant="caption" tone="textSecondary" numberOfLines={2}>
          {info.description}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Znak rozpoznawczy stylu w miniaturze paska: słońce, pieczątka, płatek, kursor. */
function PreviewMark({ styleKey, colors }: { styleKey: ThemeStyle; colors: ThemeColors }) {
  switch (styleKey) {
    case 'vaporwave':
      return <View style={[styles.previewSun, { backgroundColor: colors.decorAlt }]} />;
    case 'zen':
      return <View style={[styles.previewSeal, { backgroundColor: colors.decorAlt }]} />;
    case 'sakura':
      return <View style={[styles.previewPetal, { backgroundColor: colors.decor }]} />;
    case 'terminal':
      return <View style={[styles.previewCursor, { backgroundColor: colors.accent }]} />;
    default:
      return null;
  }
}

/** Nazwa stylu jego własnym krojem (np. „Zen” Garamondem). */
function styleNameFont(family: string | undefined) {
  return family ? { fontFamily: family, fontWeight: 'normal' as const, fontSize: 20, lineHeight: 24 } : undefined;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  styles: { gap: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, borderWidth: 2 },
  optionText: { flex: 1, gap: 2 },
  previews: { flexDirection: 'row', gap: spacing.xs, width: 128 },
  preview: { flex: 1, height: 64, borderRadius: radius.sm, overflow: 'hidden' },
  previewBar: { height: 18, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', paddingRight: 6, overflow: 'hidden' },
  previewSun: { width: 16, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  previewSeal: { width: 5, height: 7, borderRadius: 1, marginLeft: 1, marginBottom: 2 },
  previewPetal: { width: 8, height: 8, borderRadius: 4, borderTopLeftRadius: 0, marginBottom: 3 },
  previewCursor: { width: 5, height: 9, marginBottom: 3 },
  previewCard: { margin: 6, padding: 5, gap: 4, borderRadius: 5, borderWidth: 1 },
  previewLine: { height: 4, borderRadius: 2 },
  previewShort: { width: '60%' },
});
