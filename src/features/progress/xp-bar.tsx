import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Meter } from '@/features/stats/charts';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { useXp } from './xp-provider';

/** Cienki pasek poziomu na ekranie Dziś — stuknięcie otwiera Postęp. Znika, gdy moduł jest ukryty. */
export function XpBar() {
  const summary = useXp();
  const { colors } = useTheme();
  if (!summary) return null;

  const { level } = summary;
  const inLevel = `${level.xp - level.from}/${level.to - level.from} XP`;
  return (
    <Card
      onPress={() => router.push('/postep')}
      style={styles.card}
      accessibilityLabel={`Poziom ${level.level}, ${inLevel}, dziś ${summary.today} XP. Otwórz Postęp`}>
      <View style={styles.row}>
        <AppText variant="bodyStrong">Poz. {level.level}</AppText>
        <View style={styles.meter}>
          <Meter value={level.progress} color={colors.accent} />
        </View>
        <AppText variant="caption" tone="textSecondary">
          {summary.today > 0 ? `${inLevel} · dziś +${summary.today}` : inLevel}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meter: { flex: 1 },
});
