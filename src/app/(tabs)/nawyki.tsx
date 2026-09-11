import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import {
  HABITS_SQL,
  HABIT_DONE_DAYS_SQL,
  HABIT_LOGS_RANGE_SQL,
  moveHabit,
  setHabitCount,
  type Habit,
  type HabitLog,
} from '@/db/habits';
import { useQuery } from '@/db/use-query';
import { AmountSheet, type AmountTarget } from '@/features/habits/amount-sheet';
import { HabitCard, HabitIcon } from '@/features/habits/habit-card';
import { currentStreak, habitStartDay, isScheduled } from '@/features/habits/streak';
import { weekOf, type DateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

export default function HabitsScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const { colors, dark } = useTheme();
  const week = weekOf(today);
  const [reordering, setReordering] = useState(false);
  const [amountTarget, setAmountTarget] = useState<AmountTarget | null>(null);

  const { rows: habits, loaded } = useQuery<Habit>(HABITS_SQL, [], ['habits']);
  const { rows: logs } = useQuery<HabitLog>(
    HABIT_LOGS_RANGE_SQL,
    { $from: week[0], $to: week[6] },
    ['habit_logs'],
  );
  const { rows: doneRows } = useQuery<Pick<HabitLog, 'habit_id' | 'date'>>(
    HABIT_DONE_DAYS_SQL,
    [],
    ['habits', 'habit_logs'],
  );
  const { rows: archivedRows } = useQuery<{ count: number }>(
    'SELECT COUNT(*) AS count FROM habits WHERE archived = 1',
    [],
    ['habits'],
  );
  const archivedCount = archivedRows[0]?.count ?? 0;

  const countsByHabit = new Map<number, Map<DateKey, number>>();
  for (const log of logs) {
    if (!countsByHabit.has(log.habit_id)) countsByHabit.set(log.habit_id, new Map());
    countsByHabit.get(log.habit_id)!.set(log.date, log.count);
  }
  const doneByHabit = new Map<number, Set<DateKey>>();
  for (const row of doneRows) {
    if (!doneByHabit.has(row.habit_id)) doneByHabit.set(row.habit_id, new Set());
    doneByHabit.get(row.habit_id)!.add(row.date);
  }

  const streakOf = (habit: Habit) => {
    const done = doneByHabit.get(habit.id) ?? new Set<DateKey>();
    return currentStreak(done, today, habit.days_mask, habitStartDay(habit.created_at, done));
  };

  // Licznik w nagłówku dotyczy tylko nawyków zaplanowanych na dziś.
  const dueToday = habits.filter((habit) => isScheduled(habit.days_mask, today));
  const doneToday = dueToday.filter(
    (habit) => (countsByHabit.get(habit.id)?.get(today) ?? 0) >= habit.target_per_day,
  ).length;

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
          <View style={styles.headerActions}>
            {habits.length > 1 ? (
              <IconButton icon="swap_vert" accessibilityLabel="Zmień kolejność" onPress={() => setReordering(true)} />
            ) : null}
            <IconButton icon="add" variant="filled" accessibilityLabel="Nowy nawyk" onPress={() => openHabit('nowy')} />
          </View>
        )
      }>
      <FlatList
        data={habits}
        keyExtractor={(habit) => String(habit.id)}
        renderItem={({ item, index }) =>
          reordering ? (
            <View style={[styles.reorderRow, { backgroundColor: colors.surface }]}>
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
            </View>
          ) : (
            <HabitCard
              habit={item}
              week={week}
              today={today}
              counts={countsByHabit.get(item.id) ?? new Map()}
              streak={streakOf(item)}
              onChangeCount={(date, count) => setHabitCount(db, item.id, date, count)}
              onEditAmount={(date) =>
                setAmountTarget({ habit: item, date, count: countsByHabit.get(item.id)?.get(date) ?? 0 })
              }
              onPress={() => openHabit(item.id)}
            />
          )
        }
        ItemSeparatorComponent={Separator}
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
      <AmountSheet
        target={amountTarget}
        today={today}
        onSave={({ habit, date }, count) => setHabitCount(db, habit.id, date, count)}
        onClose={() => setAmountTarget(null)}
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  list: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  separator: { height: spacing.md },
  flex: { flex: 1 },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  archiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
});
