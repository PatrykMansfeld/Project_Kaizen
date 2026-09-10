import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { FlatList, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import {
  HABITS_SQL,
  HABIT_DONE_DAYS_SQL,
  HABIT_LOGS_RANGE_SQL,
  setHabitCount,
  type Habit,
  type HabitLog,
} from '@/db/habits';
import { useQuery } from '@/db/use-query';
import { HabitCard } from '@/features/habits/habit-card';
import { currentStreak } from '@/features/habits/palette';
import { weekOf, type DateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

export default function HabitsScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();
  const week = weekOf(today);

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

  const doneToday = habits.filter(
    (habit) => (countsByHabit.get(habit.id)?.get(today) ?? 0) >= habit.target_per_day,
  ).length;

  const openHabit = (id: number | 'nowy') =>
    router.push({ pathname: '/nawyk/[id]', params: { id: String(id) } });

  return (
    <Screen
      title="Nawyki"
      subtitle={habits.length ? `Dziś: ${doneToday} z ${habits.length}` : undefined}
      headerRight={
        <IconButton icon="add" variant="filled" accessibilityLabel="Nowy nawyk" onPress={() => openHabit('nowy')} />
      }>
      <FlatList
        data={habits}
        keyExtractor={(habit) => String(habit.id)}
        renderItem={({ item }) => (
          <HabitCard
            habit={item}
            week={week}
            today={today}
            counts={countsByHabit.get(item.id) ?? new Map()}
            streak={currentStreak(doneByHabit.get(item.id) ?? new Set(), today)}
            onChangeCount={(date, count) => setHabitCount(db, item.id, date, count)}
            onPress={() => openHabit(item.id)}
          />
        )}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.list}
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
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  separator: { height: spacing.md },
});
