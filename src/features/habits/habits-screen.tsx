import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { HeaderActions } from '@/components/header';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SeparatorLarge } from '@/components/separator';
import {
  HABITS_SQL,
  HABIT_DONE_DAYS_SQL,
  HABIT_LOGS_RANGE_SQL,
  countsByHabit,
  doneDaysByHabit,
  moveHabit,
  type Habit,
  type HabitDoneDay,
  type HabitLog,
} from '@/db/habits';
import { useQuery } from '@/db/use-query';
import { HabitCard, HabitIcon } from '@/features/habits/habit-card';
import { currentStreak, currentWeeklyStreak, habitStartDay, isScheduled } from '@/features/habits/streak';
import { useHabitCounter } from '@/features/habits/use-habit-counter';
import { weekOf, type DateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

export function HabitsScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const { colors, dark } = useTheme();
  const week = weekOf(today);
  const [reordering, setReordering] = useState(false);
  const { tap, hold, sheet } = useHabitCounter(today);

  const { rows: habits, loaded } = useQuery<Habit>(HABITS_SQL, [], ['habits']);
  const { rows: logs } = useQuery<HabitLog>(
    HABIT_LOGS_RANGE_SQL,
    { $from: week[0], $to: week[6] },
    ['habit_logs'],
  );
  const { rows: doneRows } = useQuery<HabitDoneDay>(HABIT_DONE_DAYS_SQL, [], ['habits', 'habit_logs']);
  const { rows: archivedRows } = useQuery<{ count: number }>(
    'SELECT COUNT(*) AS count FROM habits WHERE archived = 1',
    [],
    ['habits'],
  );
  const archivedCount = archivedRows[0]?.count ?? 0;

  const counts = countsByHabit(logs);
  const doneByHabit = doneDaysByHabit(doneRows);
  const countsOf = (habit: Habit) => counts.get(habit.id) ?? new Map<DateKey, number>();

  const streakOf = (habit: Habit) => {
    const done = doneByHabit.get(habit.id) ?? new Set<DateKey>();
    const since = habitStartDay(habit.created_at, done);
    return habit.weekly_target
      ? currentWeeklyStreak(done, today, habit.weekly_target, since)
      : currentStreak(done, today, habit.days_mask, since);
  };

  // Licznik w nagłówku: nawyki zaplanowane na dziś; tygodniowe — dopóki cel tygodnia nie jest osiągnięty.
  const dueToday = habits.filter((habit) => {
    if (!habit.weekly_target) return isScheduled(habit.days_mask, today);
    const habitCounts = countsOf(habit);
    const weekDone = week.filter((day) => (habitCounts.get(day) ?? 0) >= habit.target_per_day).length;
    const doneToday = (habitCounts.get(today) ?? 0) >= habit.target_per_day;
    return doneToday || weekDone < habit.weekly_target;
  });
  const doneToday = dueToday.filter((habit) => (countsOf(habit).get(today) ?? 0) >= habit.target_per_day).length;

  const openHabit = (id: number | 'nowy') =>
    router.push({ pathname: '/nawyk/[id]', params: { id: String(id) } });

  return (
    <Screen
      title="Nawyki"
      subtitle={dueToday.length ? `Dziś: ${doneToday} z ${dueToday.length}` : undefined}
      headerRight={
        reordering ? (
          <Chip label="Gotowe" icon="check" selected onPress={() => setReordering(false)} />
        ) : (
          <HeaderActions>
            {habits.length > 1 ? (
              <IconButton icon="swap_vert" accessibilityLabel="Zmień kolejność" onPress={() => setReordering(true)} />
            ) : null}
            <IconButton icon="add" variant="filled" accessibilityLabel="Nowy nawyk" onPress={() => openHabit('nowy')} />
          </HeaderActions>
        )
      }>
      <FlatList
        data={habits}
        keyExtractor={(habit) => String(habit.id)}
        renderItem={({ item, index }) =>
          reordering ? (
            <Card variant="row" style={styles.reorderRow}>
              <HabitIcon icon={item.icon} color={paletteColor(item.color, dark)} size={36} />
              <AppText style={styles.flex} numberOfLines={1}>
                {item.name}
              </AppText>
              <IconButton
                icon="arrow_upward"
                accessibilityLabel={`Przesuń ${item.name} w górę`}
                color={index === 0 ? colors.border : colors.text}
                onPress={() => index > 0 && moveHabit(db, item.id, -1)}
              />
              <IconButton
                icon="arrow_downward"
                accessibilityLabel={`Przesuń ${item.name} w dół`}
                color={index === habits.length - 1 ? colors.border : colors.text}
                onPress={() => index < habits.length - 1 && moveHabit(db, item.id, 1)}
              />
            </Card>
          ) : (
            <HabitCard
              habit={item}
              week={week}
              today={today}
              counts={countsOf(item)}
              streak={streakOf(item)}
              onTap={(date) => tap(item, date, countsOf(item).get(date) ?? 0)}
              onHold={(date) => hold(item, date, countsOf(item).get(date) ?? 0)}
              onPress={() => openHabit(item.id)}
            />
          )
        }
        ItemSeparatorComponent={SeparatorLarge}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          archivedCount > 0 && !reordering ? (
            <Pressable
              onPress={() => router.push('/archiwum-nawykow')}
              accessibilityRole="button"
              style={styles.archiveLink}>
              <Icon name="inventory_2" size={18} color={colors.textSecondary} />
              <AppText tone="textSecondary">Zarchiwizowane ({archivedCount})</AppText>
              <Icon name="chevron_right" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          loaded ? (
            <EmptyState
              icon="check_circle"
              color={colors.habits}
              title="Brak nawyków"
              description="Dodaj pierwszy nawyk przyciskiem +, np. „Szklanka wody” 5× dziennie."
            />
          ) : null
        }
      />
      {sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  reorderRow: { gap: spacing.sm, paddingRight: spacing.xs, paddingVertical: spacing.xs },
  archiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
});
