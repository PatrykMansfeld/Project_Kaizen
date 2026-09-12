import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Chip, ChipRow } from '@/components/chip';
import { ColorSwatches } from '@/components/color-swatches';
import { useThemePreferences, type ThemeMode } from '@/theme/preferences';
import { ACCENTS, spacing, type AccentKey } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const MODES: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'Jak w telefonie' },
  { mode: 'light', label: 'Jasny' },
  { mode: 'dark', label: 'Ciemny' },
];

const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];

/** Sekcja „Wygląd” w Ustawieniach: tryb jasny/ciemny i kolor akcentu. */
export function AppearanceSettings() {
  const { dark, colors } = useTheme();
  const { mode, accent, setMode, setAccent } = useThemePreferences();

  return (
    <View style={styles.container}>
      <AppText variant="label" tone="textSecondary">
        Motyw
      </AppText>
      <ChipRow>
        {MODES.map((option) => (
          <Chip key={option.mode} label={option.label} selected={mode === option.mode} onPress={() => setMode(option.mode)} />
        ))}
      </ChipRow>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
});
