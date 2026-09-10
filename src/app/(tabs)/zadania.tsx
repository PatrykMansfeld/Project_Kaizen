import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import {
  TASK_COUNTS_SQL,
  TASK_LIST_SQL,
  setTaskDone,
  type Task,
  type TaskCounts,
  type TaskFilter,
} from '@/db/tasks';
import { useQuery } from '@/db/use-query';
import { TaskRow } from '@/features/tasks/task-row';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: 'open', label: 'Otwarte' },
  { key: 'today', label: 'Na dziś' },
  { key: 'done', label: 'Zrobione' },
];

const EMPTY: Record<TaskFilter, { title: string; description: string }> = {
  open: { title: 'Brak otwartych zadań', description: 'Dodaj pierwsze zadanie przyciskiem +.' },
  today: { title: 'Nic na dziś', description: 'Wszystko zrobione albo nic nie ma terminu na dziś.' },
  done: { title: 'Nic jeszcze nie zrobione', description: 'Odhaczone zadania pojawią się tutaj.' },
};

export default function TasksScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<TaskFilter>('open');

  const params = { $today: today };
  const { rows: tasks, loaded } = useQuery<Task>(TASK_LIST_SQL[filter], params, ['tasks']);
  const { rows: countRows } = useQuery<TaskCounts>(TASK_COUNTS_SQL, params, ['tasks']);
  const counts = countRows[0];

  return (
    <Screen
      title="Zadania"
      headerRight={
        <IconButton
          icon="add"
          variant="filled"
          accessibilityLabel="Nowe zadanie"
          onPress={() => router.push('/zadanie/nowe')}
        />
      }>
      <View style={styles.filters}>
        {FILTERS.map(({ key, label }) => (
          <Chip
            key={key}
            label={counts ? `${label} ${counts[key]}` : label}
            selected={filter === key}
            onPress={() => setFilter(key)}
          />
        ))}
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(task) => String(task.id)}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            today={today}
            onPress={() => router.push({ pathname: '/zadanie/[id]', params: { id: String(item.id) } })}
            onToggle={() => setTaskDone(db, item.id, item.completed_at === null)}
          />
        )}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loaded ? <EmptyState icon="task_alt" color={colors.tasks} {...EMPTY[filter]} /> : null
        }
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  list: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  separator: { height: spacing.sm },
});
