import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { PromptSheet } from '@/components/prompt-sheet';
import { StackHeader, useListScreenStyle } from '@/components/screen';
import { Separator } from '@/components/separator';
import { PROJECTS_SQL, createProject, type Project } from '@/db/projects';
import { useQuery } from '@/db/use-query';
import { Meter } from '@/features/stats/charts';
import { plural } from '@/lib/format';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Projekty z postępem zadań. */
export default function ProjectsScreen() {
  const db = useSQLiteContext();
  const { dark } = useTheme();
  const listStyle = useListScreenStyle();
  const [creating, setCreating] = useState(false);
  const { rows: projects, loaded } = useQuery<Project>(PROJECTS_SQL, [], ['projects', 'tasks']);

  const open = (id: number) => router.push({ pathname: '/projekt/[id]', params: { id: String(id) } });

  return (
    <>
      <StackHeader
        title="Projekty"
        headerRight={<IconButton icon="add" accessibilityLabel="Nowy projekt" onPress={() => setCreating(true)} />}
      />
      <FlatList
        {...listStyle}
        data={projects}
        keyExtractor={(project) => String(project.id)}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => {
          const total = item.open_count + item.done_count;
          const color = paletteColor(item.color, dark);
          return (
            <Card onPress={() => open(item.id)} style={styles.card}>
              <View style={styles.header}>
                <Icon name="folder" color={color} />
                <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText variant="bodyStrong">{total ? `${Math.round((item.done_count / total) * 100)}%` : '—'}</AppText>
              </View>
              <Meter value={total ? item.done_count / total : 0} color={color} />
              <AppText variant="caption" tone="textSecondary">
                {total
                  ? `${item.done_count} z ${plural(total, ['zadania', 'zadań', 'zadań'])} zrobione · ${plural(item.open_count, ['otwarte', 'otwarte', 'otwartych'])}`
                  : 'Brak zadań'}
              </AppText>
            </Card>
          );
        }}
        ListEmptyComponent={
          loaded ? (
            <EmptyState
              icon="folder"
              title="Brak projektów"
              description="Grupuj zadania w projekty, np. „Remont” albo „Praca” — zobaczysz postęp całości."
            />
          ) : null
        }
      />
      <PromptSheet
        visible={creating}
        title="Nowy projekt"
        placeholder="np. Remont, Praca, Wakacje"
        submitLabel="Utwórz"
        onSubmit={async (name) => open(await createProject(db, name))}
        onClose={() => setCreating(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
