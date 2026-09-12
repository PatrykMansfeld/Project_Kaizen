import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { getLastSet, type Exercise } from '@/db/exercises';
import { createTemplate, deleteTemplate, getTemplate, getTemplateSets, updateTemplate } from '@/db/templates';
import {
  ExerciseEditor,
  draftsFromRows,
  exerciseDraft,
  parseDrafts,
  type ExerciseDraft,
} from '@/features/activity/exercise-editor';
import { ExercisePicker } from '@/features/activity/exercise-picker';
import { confirmDelete } from '@/lib/alerts';

/** Nowy szablon: /szablon/nowy, edycja: /szablon/3. */
export default function TemplateEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowy';
  const templateId = Number(id);

  const db = useSQLiteContext();
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
    const draft = exerciseDraft(exercise, await getLastSet(db, exercise.id, null));
    setExercises((current) => [...current, draft]);
  };

  const save = async () => {
    if (!canSave || !parsed) return;
    if (isNew) await createTemplate(db, name.trim(), parsed);
    else await updateTemplate(db, templateId, name.trim(), parsed);
    router.back();
  };

  const remove = () =>
    confirmDelete('Usunąć szablon?', 'Zapisane treningi zostaną — znika tylko szablon.', async () => {
      await deleteTemplate(db, templateId);
      router.back();
    });

  return (
    <>
      <ScrollScreen
        title={isNew ? 'Nowy szablon' : 'Szablon'}
        headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
        {loaded ? (
          <>
            <TextField label="Nazwa" value={name} onChangeText={setName} placeholder="np. Push, Nogi, FBW" autoFocus={isNew} />
            <Section title="Ćwiczenia">
              <ExerciseEditor exercises={exercises} onChange={setExercises} onAddExercise={() => setPickerOpen(true)} />
              {parsed === null ? (
                <AppText variant="caption" tone="danger">
                  Wpisz liczbę powtórzeń w każdej serii (ciężar jest opcjonalny).
                </AppText>
              ) : null}
            </Section>
            {!isNew ? <Button label="Usuń szablon" variant="danger" icon="delete" onPress={remove} /> : null}
          </>
        ) : null}
      </ScrollScreen>
      <ExercisePicker
        visible={pickerOpen}
        excludeIds={exercises.map((exercise) => exercise.exerciseId)}
        onPick={addExercise}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
