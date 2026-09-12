import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button, IconButton } from '@/components/button';
import { Icon } from '@/components/icon';
import type { Exercise, ExerciseSets, WorkoutSetRow } from '@/db/exercises';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Wersje robocze w formularzu — pola jako tekst, żeby dało się je swobodnie edytować. */
export type SetDraft = { key: string; reps: string; weight: string };
export type ExerciseDraft = { key: string; exerciseId: number; name: string; sets: SetDraft[] };

let lastKey = 0;
export const newKey = () => String(++lastKey);

export function setDraft(reps: number | null, weight: number | null): SetDraft {
  return { key: newKey(), reps: reps ? String(reps) : '', weight: weight !== null ? formatDecimal(weight) : '' };
}

/** Nowe ćwiczenie w formularzu z jedną serią — podpowiedzianą z ostatniego treningu z tym ćwiczeniem. */
export function exerciseDraft(
  exercise: Exercise,
  lastSet: { reps: number | null; weight_kg: number | null } | null,
): ExerciseDraft {
  return {
    key: newKey(),
    exerciseId: exercise.id,
    name: exercise.name,
    sets: [setDraft(lastSet?.reps ?? null, lastSet?.weight_kg ?? null)],
  };
}

/** Serie z bazy → ćwiczenia w kolejności pierwszej serii. */
export function draftsFromRows(
  rows: Pick<WorkoutSetRow, 'exercise_id' | 'exercise_name' | 'reps' | 'weight_kg'>[],
): ExerciseDraft[] {
  const drafts = new Map<number, ExerciseDraft>();
  for (const row of rows) {
    if (!drafts.has(row.exercise_id)) {
      drafts.set(row.exercise_id, { key: newKey(), exerciseId: row.exercise_id, name: row.exercise_name, sets: [] });
    }
    drafts.get(row.exercise_id)!.sets.push(setDraft(row.reps, row.weight_kg));
  }
  return [...drafts.values()];
}

/** Sprawdza formularz; ćwiczenia bez serii są pomijane. null = któraś seria jest niepoprawna. */
export function parseDrafts(drafts: ExerciseDraft[]): ExerciseSets[] | null {
  const result: ExerciseSets[] = [];
  for (const draft of drafts) {
    const sets: ExerciseSets['sets'] = [];
    for (const set of draft.sets) {
      const reps = /^\d+$/.test(set.reps.trim()) ? Number(set.reps) : NaN;
      const weight = parseDecimal(set.weight);
      if (!(reps > 0) || Number.isNaN(weight)) return null;
      sets.push({ reps, weight_kg: weight });
    }
    if (sets.length > 0) result.push({ exerciseId: draft.exerciseId, sets });
  }
  return result;
}

type Props = {
  exercises: ExerciseDraft[];
  onChange: (exercises: ExerciseDraft[]) => void;
  onAddExercise: () => void;
};

export function ExerciseEditor({ exercises, onChange, onAddExercise }: Props) {
  const { colors } = useTheme();

  const updateSets = (exerciseKey: string, update: (sets: SetDraft[]) => SetDraft[]) =>
    onChange(exercises.map((exercise) => (exercise.key === exerciseKey ? { ...exercise, sets: update(exercise.sets) } : exercise)));

  const changeSet = (exerciseKey: string, setKey: string, patch: Partial<SetDraft>) =>
    updateSets(exerciseKey, (sets) => sets.map((set) => (set.key === setKey ? { ...set, ...patch } : set)));

  // Nowa seria kopiuje poprzednią — zwykle robi się kilka takich samych.
  const addSet = (exerciseKey: string) =>
    updateSets(exerciseKey, (sets) => {
      const last = sets[sets.length - 1];
      return [...sets, { key: newKey(), reps: last?.reps ?? '', weight: last?.weight ?? '' }];
    });

  return (
    <View style={styles.container}>
      {exercises.map((exercise) => (
        <View key={exercise.key} style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <AppText variant="bodyStrong" style={styles.flex}>
              {exercise.name}
            </AppText>
            <IconButton
              icon="delete"
              color={colors.textMuted}
              accessibilityLabel={`Usuń ćwiczenie ${exercise.name}`}
              onPress={() => onChange(exercises.filter((item) => item.key !== exercise.key))}
            />
          </View>

          {exercise.sets.map((set, index) => (
            <View key={set.key} style={styles.setRow}>
              <AppText variant="caption" tone="textMuted" style={styles.setNumber}>
                {index + 1}.
              </AppText>
              <SetInput
                value={set.reps}
                onChangeText={(reps) => changeSet(exercise.key, set.key, { reps })}
                placeholder="powt."
                keyboardType="number-pad"
                maxLength={3}
              />
              <AppText tone="textSecondary">×</AppText>
              <SetInput
                value={set.weight}
                onChangeText={(weight) => changeSet(exercise.key, set.key, { weight })}
                placeholder="ciężar"
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <AppText variant="caption" tone="textSecondary" style={styles.flex}>
                kg
              </AppText>
              <IconButton
                icon="close"
                color={colors.textMuted}
                accessibilityLabel={`Usuń serię ${index + 1}`}
                onPress={() => updateSets(exercise.key, (sets) => sets.filter((item) => item.key !== set.key))}
              />
            </View>
          ))}

          <Pressable onPress={() => addSet(exercise.key)} hitSlop={6} accessibilityRole="button" style={styles.addSet}>
            <Icon name="add" size={18} color={colors.accent} />
            <AppText variant="bodyStrong" tone="accent">
              Seria
            </AppText>
          </Pressable>
        </View>
      ))}

      <Button label="Dodaj ćwiczenie" icon="fitness_center" variant="secondary" onPress={onAddExercise} />
    </View>
  );
}

function SetInput(props: ComponentProps<typeof TextInput>) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      cursorColor={colors.accent}
      selectionColor={colors.accentSoft}
      textAlign="center"
      style={[styles.setInput, { color: colors.text, backgroundColor: colors.surfaceAlt }]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  flex: { flex: 1 },
  card: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.xs },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  setNumber: { width: 24, textAlign: 'right' },
  setInput: { width: 72, height: 40, borderRadius: radius.sm, fontSize: 16, paddingVertical: 0 },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.xs,
  },
});
