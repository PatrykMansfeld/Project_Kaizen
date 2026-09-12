import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { HeaderActions } from '@/components/header';
import { PromptSheet } from '@/components/prompt-sheet';
import { StackHeader, useListScreenStyle } from '@/components/screen';
import { deleteProject, renameProject } from '@/db/projects';
import { TASK_COLUMNS, TASK_TABLES, type Task } from '@/db/tasks';
import { useQuery } from '@/db/use-query';
import { Meter } from '@/features/stats/charts';
import { useTags } from '@/features/tags/tags';
import { TaskRow } from '@/features/tasks/task-row';
import { confirmDelete } from '@/lib/alerts';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Projekt: postęp, otwarte i zrobione zadania (/projekt/2). */
export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const db = useSQLiteContext();
  const today = useToday();
  const { colors, dark } = useTheme();
  const listStyle = useListScreenStyle();
  const [renaming, setRenaming] = useState(false);
  const { byId: tagsById } = useTags();

  const { rows: projectRows } = useQuery<{ name: string; color: string }>(
    'SELECT name, color FROM projects WHERE id = ?',
    [projectId],
    ['projects'],
  );
  const { rows: tasks } = useQuery<Task>(
    `SELECT ${TASK_COLUMNS} FROM tasks WHERE project_id = $project
     ORDER BY completed_at IS NOT NULL, due_date IS NULL, due_date, priority DESC, completed_at DESC, id`,
    { $project: projectId },
    TASK_TABLES,
  );
  const project = projectRows[0];
  const open = tasks.filter((task) => task.completed_at === null);
  const done = tasks.filter((task) => task.completed_at !== null);
  const color = project ? paletteColor(project.color, dark) : colors.accent;
  const sections = [
    { title: 'Do zrobienia', data: open },
    { title: 'Zrobione', data: done },
  ].filter((section) => section.data.length > 0);

  const remove = () =>
    confirmDelete('Usunąć projekt?', 'Zadania zostaną — stracą tylko przypisanie do projektu.', async () => {
      await deleteProject(db, projectId);
      router.back();
    });

  return (
    <>
      <StackHeader
        title={project?.name ?? 'Projekt'}
        headerRight={
          <HeaderActions>
            <IconButton
              icon="add"
              accessibilityLabel="Nowe zadanie w projekcie"
              onPress={() => router.push({ pathname: '/zadanie/[id]', params: { id: 'nowe', project: String(projectId) } })}
            />
            <IconButton icon="edit" accessibilityLabel="Zmień nazwę" onPress={() => setRenaming(true)} />
            <IconButton icon="delete" accessibilityLabel="Usuń projekt" onPress={remove} />
          </HeaderActions>
        }
      />
      <SectionList
        {...listStyle}
        sections={sections}
        keyExtractor={(task) => String(task.id)}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          tasks.length ? (
            <Card style={styles.progress}>
              <AppText variant="heading">{Math.round((done.length / tasks.length) * 100)}%</AppText>
              <Meter value={done.length / tasks.length} color={color} />
              <AppText variant="caption" tone="textSecondary">
                {done.length} z {tasks.length} zadań zrobione
              </AppText>
            </Card>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="label" tone="textSecondary" style={styles.sectionHeader}>
            {section.title} ({section.data.length})
          </AppText>
        )}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <TaskRow task={item} today={today} tagsById={tagsById} />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState icon="folder" title="Pusty projekt" description="Dodaj pierwsze zadanie przyciskiem + w nagłówku." />
        }
      />
      <PromptSheet
        visible={renaming}
        title="Nazwa projektu"
        initialValue={project?.name ?? ''}
        onSubmit={(name) => renameProject(db, projectId, name)}
        onClose={() => setRenaming(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  progress: { gap: spacing.sm },
  sectionHeader: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  item: { paddingBottom: spacing.sm },
});
