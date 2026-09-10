import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Chip } from '@/components/chip';
import { addDays, formatDayLong, relativeDayLabel, type DateKey } from '@/lib/dates';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  date: DateKey;
  today: DateKey;
  onChange: (date: DateKey) => void;
  /** Najpóźniejszy dozwolony dzień (np. dziś dla dziennika). */
  maxDate?: DateKey;
};

/** ‹ czwartek, 10 września › — przełączanie dzień po dniu. */
export function DayNavigator({ date, today, onChange, maxDate }: Props) {
  const { colors } = useTheme();
  const canGoNext = !maxDate || date < maxDate;
  const relative = relativeDayLabel(date, today);

  return (
    <View style={styles.container}>
      <IconButton icon="chevron_left" accessibilityLabel="Poprzedni dzień" onPress={() => onChange(addDays(date, -1))} />
      <View style={styles.center}>
        <AppText variant="bodyStrong" style={styles.text}>
          {formatDayLong(date)}
        </AppText>
        {relative ? (
          <AppText variant="caption" tone="textSecondary">
            {relative}
          </AppText>
        ) : (
          <Chip label="Wróć do dziś" selected={false} onPress={() => onChange(today)} />
        )}
      </View>
      <IconButton
        icon="chevron_right"
        accessibilityLabel="Następny dzień"
        color={canGoNext ? colors.text : colors.border}
        onPress={() => canGoNext && onChange(addDays(date, 1))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', gap: spacing.xs },
  text: { textAlign: 'center' },
});
