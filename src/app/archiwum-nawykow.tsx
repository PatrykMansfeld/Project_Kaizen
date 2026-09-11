import { Stack, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ARCHIVED_HABITS_SQL, setHabitArchived, type Habit } from '@/db/habits';
import { useQuery } from '@/db/use-query';
import { HabitIcon } from '@/features/habits/habit-card';
import { paletteColor } from '@/theme/palette';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Zarchiwizowane nawyki: historia zostaje, można je przywrócić albo usunąć na ekranie edycji. */
export default function HabitArchiveScreen() {
  const db = useSQLiteContext();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { rows: habits, loaded } = useQuery<Habit>(ARCHIVED_HABITS_SQL, [], ['habits']);

  return (
    <>
      <Stack.Screen options={{ title: 'Zarchiwizowane nawyki' }} />
      <FlatList
        data={habits}
        keyExtractor={(habit) => String(habit.id)}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/nawyk/[id]', params: { id: String(item.id) } })}
            android_ripple={{ color: colors.border }}
            style={[styles.row, { backgroundColor: colors.surface }]}>
            <HabitIcon icon={item.icon} color={paletteColor(item.color, dark)} size={36} />
            <AppText style={styles.flex} numberOfLines={1}>
              {item.name}
            </AppText>
            <Chip label="Przywróć" icon="unarchive" selected={false} onPress={() => setHabitArchived(db, item.id, false)} />
          </Pressable>
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

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, padding: spacing.lg },
  hint: { paddingBottom: spacing.md },
  separator: { height: spacing.sm },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
