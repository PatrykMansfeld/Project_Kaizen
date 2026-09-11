import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { getLastSet, type Exercise } from '@/db/exercises';
import { createTemplate, deleteTemplate, getTemplate, getTemplateSets, updateTemplate } from '@/db/templates';
import {
  ExerciseEditor,
  draftsFromRows,
  newKey,
  parseDrafts,
  setDraft,
  type ExerciseDraft,
} from '@/features/activity/exercise-editor';
import { ExercisePicker } from '@/features/activity/exercise-picker';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Nowy szablon: /szablon/nowy, edycja: /szablon/3. */
export default function TemplateEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowy';
  const templateId = Number(id);

  const db = useSQLiteContext();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [loaded, setLoaded] = useState(isNew);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (isNew) return;
    Promise.all([getTemplate(db, templateId), getTemplateSets(db, templateId)]).then(([template, sets]) => {
      if (!template) {
        router.back();
        return;
      }
      setName(template.name);
      setExercises(draftsFromRows(sets));
      setLoaded(true);
    });
  }, [db, isNew, templateId]);

  const parsed = parseDrafts(exercises);
  const canSave = loaded && name.trim().length > 0 && parsed !== null && parsed.length > 0;

  const addExercise = async (exercise: Exercise) => {
    const last = await getLastSet(db, exercise.id, null);
    setExercises((current) => [
      ...current,
      { key: newKey(), exerciseId: exercise.id, name: exercise.name, sets: [setDraft(last?.reps ?? null, last?.weight_kg ?? null)] },
    ]);
  };

  const save = async () => {
    if (!canSave || !parsed) return;
    if (isNew) await createTemplate(db, name.trim(), parsed);
    else await updateTemplate(db, templateId, name.trim(), parsed);
    router.back();
  };

  const confirmDelete = () =>
    Alert.alert('Usunąć szablon?', 'Zapisane treningi zostaną — znika tylko szablon.', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          await deleteTemplate(db, templateId);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'Nowy szablon' : 'Szablon',
          headerRight: () => (
            <Pressable onPress={save} disabled={!canSave} hitSlop={8} accessibilityRole="button">
              <AppText variant="bodyStrong" tone={canSave ? 'accent' : 'textMuted'}>
                Zapisz
              </AppText>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {loaded ? (
          <>
            <TextField label="Nazwa" value={name} onChangeText={setName} placeholder="np. Push, Nogi, FBW" autoFocus={isNew} />
            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Ćwiczenia
              </AppText>
              <ExerciseEditor exercises={exercises} onChange={setExercises} onAddExercise={() => setPickerOpen(true)} />
              {parsed === null ? (
                <AppText variant="caption" tone="danger">
                  Wpisz liczbę powtórzeń w każdej serii (ciężar jest opcjonalny).
                </AppText>
              ) : null}
            </View>
            {!isNew ? <Button label="Usuń szablon" variant="danger" icon="delete" onPress={confirmDelete} /> : null}
          </>
        ) : null}
      </ScrollView>
      <ExercisePicker
        visible={pickerOpen}
        excludeIds={exercises.map((exercise) => exercise.exerciseId)}
        onPick={addExercise}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, padding: spacing.lg },
  section: { gap: spacing.sm },
});
