import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { FlatList, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { StackHeader, useListScreenStyle } from '@/components/screen';
import { Separator } from '@/components/separator';
import { ARCHIVED_HABITS_SQL, setHabitArchived, type Habit } from '@/db/habits';
import { useQuery } from '@/db/use-query';
import { HabitIcon } from '@/features/habits/habit-card';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Zarchiwizowane nawyki: historia zostaje, można je przywrócić albo usunąć na ekranie edycji. */
export default function HabitArchiveScreen() {
  const db = useSQLiteContext();
  const { colors, dark } = useTheme();
  const listStyle = useListScreenStyle();
  const { rows: habits, loaded } = useQuery<Habit>(ARCHIVED_HABITS_SQL, [], ['habits']);

  return (
    <>
      <StackHeader title="Zarchiwizowane nawyki" />
      <FlatList
        {...listStyle}
        data={habits}
        keyExtractor={(habit) => String(habit.id)}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <Card
            variant="row"
            style={styles.row}
            onPress={() => router.push({ pathname: '/nawyk/[id]', params: { id: String(item.id) } })}>
            <HabitIcon icon={item.icon} color={paletteColor(item.color, dark)} size={36} />
            <AppText style={styles.flex} numberOfLines={1}>
              {item.name}
            </AppText>
            <Chip label="Przywróć" icon="unarchive" selected={false} onPress={() => setHabitArchived(db, item.id, false)} />
          </Card>
        )}
        ListHeaderComponent={
          habits.length ? (
            <AppText variant="caption" tone="textSecondary" style={styles.hint}>
              Zarchiwizowane nawyki nie pojawiają się na listach ani w przypomnieniach, ale ich historia zostaje.
            </AppText>
          ) : null
        }
        ListEmptyComponent={
          loaded ? <EmptyState icon="inventory_2" title="Archiwum jest puste" color={colors.habits} /> : null
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  hint: { paddingBottom: spacing.md },
  flex: { flex: 1 },
  row: { paddingVertical: spacing.sm },
});
