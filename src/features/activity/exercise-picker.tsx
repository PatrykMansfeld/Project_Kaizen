import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetTitle } from '@/components/bottom-sheet';
import { Icon } from '@/components/icon';
import { SearchField } from '@/components/search-field';
import { EXERCISES_SQL, createExercise, type Exercise } from '@/db/exercises';
import { useQuery } from '@/db/use-query';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  visible: boolean;
  /** Ćwiczenia już dodane do treningu — nie pokazujemy ich drugi raz. */
  excludeIds: number[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
};

/** Wybór ćwiczenia z katalogu z wyszukiwarką; brakujące można od razu dodać. */
export function ExercisePicker({ visible, onClose, ...rest }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} tall gap={spacing.md}>
      <PickerContent onClose={onClose} {...rest} />
    </BottomSheet>
  );
}

function PickerContent({ excludeIds, onPick, onClose }: Omit<Props, 'visible'>) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const { rows: exercises } = useQuery<Exercise>(EXERCISES_SQL, [], ['exercises']);

  const query = search.trim();
  const lower = query.toLowerCase();
  const visible = exercises
    .filter((exercise) => !excludeIds.includes(exercise.id) && exercise.name.toLowerCase().includes(lower))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  const exactMatch = exercises.some((exercise) => exercise.name.toLowerCase() === lower);

  const pick = (exercise: Exercise) => {
    onPick(exercise);
    onClose();
  };

  const addNew = async () => {
    pick(await createExercise(db, query));
  };

  return (
    <>
      <SheetTitle title="Dodaj ćwiczenie" onClose={onClose} />
      <SearchField value={search} onChangeText={setSearch} placeholder="Szukaj lub wpisz nowe" />

      <FlatList
        data={visible}
        keyExtractor={(exercise) => String(exercise.id)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          query && !exactMatch ? (
            <Pressable onPress={addNew} android_ripple={{ color: colors.border }} style={styles.row}>
              <Icon name="add" color={colors.accent} />
              <AppText variant="bodyStrong" tone="accent" style={styles.flex}>
                Dodaj „{query}”
              </AppText>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => pick(item)} android_ripple={{ color: colors.border }} style={styles.row}>
            <Icon name="fitness_center" size={20} color={colors.activity} />
            <AppText style={styles.flex}>{item.name}</AppText>
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
});
