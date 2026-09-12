import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { HeaderActions } from '@/components/header';
import { Screen } from '@/components/screen';
import { Separator } from '@/components/separator';
import {
  TASK_COUNTS_SQL,
  TASK_LIST_SQL,
  TASK_TABLES,
  type Task,
  type TaskCounts,
  type TaskFilter,
} from '@/db/tasks';
import { useQuery } from '@/db/use-query';
import { TagFilter, useTags } from '@/features/tags/tags';
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

export function TasksScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<TaskFilter>('open');
  const [tag, setTag] = useState<number | null>(null);
  const { byId: tagsById } = useTags();

  const params = { $today: today, $tag: tag };
  const { rows: tasks, loaded } = useQuery<Task>(TASK_LIST_SQL[filter], params, TASK_TABLES);
  const { rows: countRows } = useQuery<TaskCounts>(TASK_COUNTS_SQL, params, TASK_TABLES);
  const counts = countRows[0];

  return (
    <Screen
      title="Zadania"
      headerRight={
        <HeaderActions>
          <IconButton icon="folder" accessibilityLabel="Projekty" onPress={() => router.push('/projekty')} />
          <IconButton
            icon="add"
            variant="filled"
            accessibilityLabel="Nowe zadanie"
            onPress={() => router.push('/zadanie/nowe')}
          />
        </HeaderActions>
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
      <TagFilter selected={tag} onChange={setTag} />

      <FlatList
        data={tasks}
        keyExtractor={(task) => String(task.id)}
        renderItem={({ item }) => (
          <TaskRow task={item} today={today} tagsById={tagsById} />
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

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  list: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});
