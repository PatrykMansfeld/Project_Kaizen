import { useSQLiteContext } from 'expo-sqlite';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import type { HabitWithCount } from '@/db/day';
import { nextHabitCount, setHabitCount } from '@/db/habits';
import { buttonLabel, isAmountHabit } from '@/features/habits/amount';
import { AmountSheet, type AmountTarget } from '@/features/habits/amount-sheet';
import { HabitIcon, HabitProgressButton } from '@/features/habits/habit-card';
import { isScheduled } from '@/features/habits/streak';
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
  const db = useSQLiteContext();
  const { colors, dark } = useTheme();
  const [amountTarget, setAmountTarget] = useState<AmountTarget | null>(null);

  const change = (habit: HabitWithCount, count: number) => setHabitCount(db, habit.id, date, count);
  const tap = (habit: HabitWithCount) =>
    isAmountHabit(habit)
      ? setAmountTarget({ habit, date, count: habit.count })
      : change(habit, nextHabitCount(habit.count, habit.target_per_day));
  const hold = (habit: HabitWithCount) =>
    isAmountHabit(habit)
      ? setAmountTarget({ habit, date, count: habit.count })
      : habit.count > 0 && change(habit, habit.count - 1);

  return (
    <>
      {variant === 'rows' ? (
        <View style={styles.rows}>
          {habits.map((habit) => {
            const color = paletteColor(habit.color, dark);
            return (
              <View key={habit.id} style={[styles.row, { backgroundColor: colors.surface }]}>
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
                  onPress={() => tap(habit)}
                  onLongPress={() => hold(habit)}
                />
              </View>
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
                onPress={() => tap(habit)}
                onLongPress={() => hold(habit)}
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
      <AmountSheet
        target={amountTarget}
        today={today}
        onSave={({ habit }, count) => setHabitCount(db, habit.id, date, count)}
        onClose={() => setAmountTarget(null)}
      />
    </>
  );
}

type SectionProps = {
  icon: IconName;
  color: string;
  title: string;
  meta?: string;
  onAdd?: () => void;
  children: ReactNode;
};

/** Sekcja dnia: ikona modułu, tytuł, licznik po prawej i opcjonalne „+”. */
export function DaySection({ icon, color, title, meta, onAdd, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name={icon} size={18} color={color} />
        <AppText variant="label" tone="textSecondary" style={styles.flex}>
          {title}
        </AppText>
        {meta ? (
          <AppText variant="caption" tone="textSecondary">
            {meta}
          </AppText>
        ) : null}
        {onAdd ? <IconButton icon="add" accessibilityLabel={`Dodaj: ${title.toLowerCase()}`} onPress={onAdd} /> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  rows: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
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
