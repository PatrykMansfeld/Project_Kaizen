import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import type { HabitWithCount } from '@/db/day';
import { buttonLabel } from '@/features/habits/amount';
import { HabitIcon, HabitProgressButton } from '@/features/habits/habit-card';
import { isScheduled } from '@/features/habits/streak';
import { useHabitCounter } from '@/features/habits/use-habit-counter';
import type { DateKey } from '@/lib/dates';
import { paletteColor } from '@/theme/palette';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Nawyki zaplanowane na ten dzień tygodnia oraz te, które i tak odhaczono. */
export function habitsForDay(habits: HabitWithCount[], date: DateKey) {
  return habits.filter((habit) => habit.count > 0 || isScheduled(habit.days_mask, date));
}

type Props = {
  habits: HabitWithCount[];
  date: DateKey;
  today: DateKey;
  /** rows — pełne wiersze z przyciskiem, chips — zwarte kafelki z emoji. */
  variant: 'rows' | 'chips';
};

/** Odhaczanie nawyków danego dnia: licznik +1/−1, ilość przez okienko. */
export function DayHabits({ habits, date, today, variant }: Props) {
  const { colors, dark } = useTheme();
  const { tap, hold, sheet } = useHabitCounter(today);

  return (
    <>
      {variant === 'rows' ? (
        <View style={styles.rows}>
          {habits.map((habit) => {
            const color = paletteColor(habit.color, dark);
            return (
              <Card key={habit.id} variant="row" style={styles.row}>
                <HabitIcon icon={habit.icon} color={color} size={36} />
                <AppText style={styles.flex} numberOfLines={1}>
                  {habit.name}
                </AppText>
                <HabitProgressButton
                  count={habit.count}
                  target={habit.target_per_day}
                  color={color}
                  size={36}
                  label={buttonLabel(habit.count, habit)}
                  onPress={() => tap(habit, date, habit.count)}
                  onLongPress={() => hold(habit, date, habit.count)}
                />
              </Card>
            );
          })}
        </View>
      ) : (
        <View style={styles.chips}>
          {habits.map((habit) => {
            const color = paletteColor(habit.color, dark);
            const done = habit.count >= habit.target_per_day;
            return (
              <Pressable
                key={habit.id}
                onPress={() => tap(habit, date, habit.count)}
                onLongPress={() => hold(habit, date, habit.count)}
                accessibilityLabel={`${habit.name}: ${habit.count} z ${habit.target_per_day}`}
                style={[
                  styles.chip,
                  { backgroundColor: withAlpha(color, done ? 0.22 : 0.07), borderColor: done ? color : colors.border },
                ]}>
                <Text style={styles.emoji}>{habit.icon}</Text>
                {done ? (
                  <Icon name="check" size={16} color={color} />
                ) : habit.target_per_day > 1 ? (
                  <AppText variant="caption" tone="textSecondary">
                    {buttonLabel(habit.count, habit)}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
      {sheet}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rows: { gap: spacing.sm },
  row: { paddingVertical: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  emoji: { fontSize: 20 },
});
