import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Icon } from '@/components/icon';
import { SearchField } from '@/components/search-field';
import { EXERCISES_SQL, createExercise, type Exercise } from '@/db/exercises';
import { useQuery } from '@/db/use-query';
import { radius, spacing } from '@/theme/theme';
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <PickerContent onClose={onClose} {...rest} />
    </Modal>
  );
}

function PickerContent({ excludeIds, onPick, onClose }: Omit<Props, 'visible'>) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Zamknij" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <AppText variant="heading" style={styles.flex}>
            Dodaj ćwiczenie
          </AppText>
          <IconButton icon="close" accessibilityLabel="Zamknij" onPress={onClose} />
        </View>
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { height: '15%', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
});
