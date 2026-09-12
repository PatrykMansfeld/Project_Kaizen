import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { DateChoice } from '@/components/date-choice';
import { HeaderTextButton } from '@/components/header';
import { Icon } from '@/components/icon';
import { PromptSheet } from '@/components/prompt-sheet';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { getLastSet, getWorkoutSets, replaceWorkoutSets, type Exercise } from '@/db/exercises';
import { TEMPLATES_SQL, createTemplate, getTemplateSets, type WorkoutTemplate } from '@/db/templates';
import { useQuery } from '@/db/use-query';
import { createWorkout, deleteWorkout, getWorkout, updateWorkout } from '@/db/workouts';
import {
  ExerciseEditor,
  draftsFromRows,
  exerciseDraft,
  parseDrafts,
  type ExerciseDraft,
} from '@/features/activity/exercise-editor';
import { ExercisePicker } from '@/features/activity/exercise-picker';
import { describeBeatenRecords } from '@/features/activity/records';
import { WORKOUT_TYPES, WORKOUT_TYPE_KEYS, workoutPace, type WorkoutType } from '@/features/activity/workout-types';
import { confirmDelete } from '@/lib/alerts';
import { addDays, isDateKey, type DateKey } from '@/lib/dates';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const QUICK_DURATIONS = [15, 30, 45, 60, 90];

type Form = {
  type: WorkoutType;
  date: DateKey;
  duration: string;
  distance: string;
  note: string;
  /** Tylko dla siłowni. */
  exercises: ExerciseDraft[];
};

/** Nowy trening: /trening/nowy (opcjonalnie ?date=2026-09-10), edycja: /trening/123. */
export default function WorkoutEditScreen() {
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const isNew = params.id === 'nowy';
  const workoutId = Number(params.id);

  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();

  const [form, setForm] = useState<Form>({
    type: 'run',
    date: isDateKey(params.date) ? params.date : today,
    duration: '',
    distance: '',
    note: '',
    exercises: [],
  });
  const [loaded, setLoaded] = useState(isNew);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [templateNameOpen, setTemplateNameOpen] = useState(false);
  const { rows: templates } = useQuery<WorkoutTemplate>(TEMPLATES_SQL, [], ['workout_templates', 'template_sets']);

  useEffect(() => {
    if (isNew) return;
    Promise.all([getWorkout(db, workoutId), getWorkoutSets(db, workoutId)]).then(([workout, sets]) => {
      if (!workout) {
        router.back();
        return;
      }
      setForm({
        type: workout.type,
        date: workout.date,
        duration: workout.duration_min ? String(workout.duration_min) : '',
        distance: workout.distance_km ? formatDecimal(workout.distance_km) : '',
        note: workout.note,
        exercises: draftsFromRows(sets),
      });
      setLoaded(true);
    });
  }, [db, isNew, workoutId]);

  // Szablon podmienia listę ćwiczeń (po potwierdzeniu, jeśli coś już wpisano).
  const applyTemplate = async (templateId: number) => {
    const drafts = draftsFromRows(await getTemplateSets(db, templateId));
    const apply = () => setForm((current) => ({ ...current, exercises: drafts }));
    if (form.exercises.length === 0) return apply();
    Alert.alert('Wczytać szablon?', 'Obecna lista ćwiczeń zostanie zastąpiona ćwiczeniami z szablonu.', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Wczytaj', onPress: apply },
    ]);
  };

  const saveAsTemplate = async (name: string) => {
    if (!exerciseSets?.length) return;
    await createTemplate(db, name, exerciseSets);
    Alert.alert('Zapisano szablon', `„${name}” pojawi się przy kolejnym treningu siłowym.`);
  };

  // Nowe ćwiczenie dostaje pierwszą serię z ostatniego treningu, w którym było robione.
  const addExercise = async (exercise: Exercise) => {
    const draft = exerciseDraft(exercise, await getLastSet(db, exercise.id, isNew ? null : workoutId));
    setForm((current) => ({ ...current, exercises: [...current.exercises, draft] }));
  };

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));

  const typeInfo = WORKOUT_TYPES[form.type];
  const duration = /^\d+$/.test(form.duration.trim()) ? Number(form.duration) : NaN;
  const distance = typeInfo.hasDistance ? parseDecimal(form.distance) : null;
  const durationValid = duration > 0;
  const distanceValid = distance === null || distance > 0;
  const isGym = form.type === 'gym';
  const exerciseSets = isGym ? parseDrafts(form.exercises) : [];
  const canSave = loaded && durationValid && distanceValid && exerciseSets !== null;
  const pace = durationValid && distance ? workoutPace(form.type, duration, distance) : null;

  const save = async () => {
    if (!canSave || exerciseSets === null) return;
    const input = {
      type: form.type,
      date: form.date,
      duration_min: duration,
      distance_km: distance,
      note: form.note.trim(),
    };
    // Trening i jego serie zapisują się razem albo wcale.
    let id = workoutId;
    await db.withTransactionAsync(async () => {
      if (isNew) {
        id = (await createWorkout(db, input)).lastInsertRowId;
      } else {
        await updateWorkout(db, workoutId, input);
      }
      await replaceWorkoutSets(db, id, exerciseSets);
    });

    const beaten = await describeBeatenRecords(
      db,
      id,
      form.date,
      exerciseSets.map((exercise) => ({
        ...exercise,
        name: form.exercises.find((draft) => draft.exerciseId === exercise.exerciseId)?.name ?? '',
      })),
    );
    if (beaten.length) {
      Alert.alert('Nowy rekord! 🏆', beaten.join('\n'), [{ text: 'Super', onPress: () => router.back() }]);
    } else {
      router.back();
    }
  };

  const remove = () =>
    confirmDelete('Usunąć trening?', undefined, async () => {
      await deleteWorkout(db, workoutId);
      router.back();
    });

  return (
    <>
      <ScrollScreen
        title={isNew ? 'Nowy trening' : 'Trening'}
        headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
        {loaded ? (
          <>
            <View style={styles.typeGrid}>
              {WORKOUT_TYPE_KEYS.map((type) => {
                const selected = form.type === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => update({ type })}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[
                      styles.typeTile,
                      selected
                        ? { backgroundColor: colors.activity, borderColor: colors.activity }
                        : { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}>
                    <Icon name={WORKOUT_TYPES[type].icon} size={28} color={selected ? colors.onAccent : colors.activity} />
                    <AppText variant="caption" style={{ fontWeight: '600', color: selected ? colors.onAccent : colors.text }}>
                      {WORKOUT_TYPES[type].label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <Section title="Data">
              <DateChoice
                value={form.date}
                onChange={(date) => date && update({ date })}
                today={today}
                pickerTitle="Data treningu"
                presets={[
                  { label: 'Dziś', date: today },
                  { label: 'Wczoraj', date: addDays(today, -1) },
                ]}
              />
            </Section>

            <View style={styles.field}>
              <TextField
                label="Czas trwania (min)"
                value={form.duration}
                onChangeText={(text) => update({ duration: text })}
                placeholder="np. 45"
                keyboardType="number-pad"
                maxLength={4}
              />
              <ChipRow>
                {QUICK_DURATIONS.map((minutes) => (
                  <Chip
                    key={minutes}
                    label={`${minutes} min`}
                    selected={duration === minutes}
                    onPress={() => update({ duration: String(minutes) })}
                  />
                ))}
              </ChipRow>
            </View>

            {typeInfo.hasDistance ? (
              <View style={styles.field}>
                <TextField
                  label="Dystans (km, opcjonalnie)"
                  value={form.distance}
                  onChangeText={(text) => update({ distance: text })}
                  placeholder="np. 5,2"
                  keyboardType="decimal-pad"
                  maxLength={7}
                />
                {!distanceValid ? (
                  <AppText variant="caption" tone="danger">
                    Wpisz liczbę, np. 5,2
                  </AppText>
                ) : pace ? (
                  <AppText variant="caption" tone="textSecondary">
                    {form.type === 'bike' ? 'Średnia prędkość' : 'Tempo'}: {pace}
                  </AppText>
                ) : null}
              </View>
            ) : null}

            {isGym ? (
              <Section
                title="Ćwiczenia"
                action={
                  <Pressable onPress={() => router.push('/szablony')} hitSlop={8} accessibilityRole="button">
                    <AppText variant="caption" tone="accent">
                      Szablony ›
                    </AppText>
                  </Pressable>
                }>
                {templates.length > 0 ? (
                  <ChipRow>
                    {templates.map((template) => (
                      <Chip
                        key={template.id}
                        label={template.name}
                        icon="content_copy"
                        selected={false}
                        onPress={() => applyTemplate(template.id)}
                      />
                    ))}
                  </ChipRow>
                ) : null}
                <ExerciseEditor
                  exercises={form.exercises}
                  onChange={(exercises) => update({ exercises })}
                  onAddExercise={() => setExercisePickerOpen(true)}
                />
                {exerciseSets === null ? (
                  <AppText variant="caption" tone="danger">
                    Wpisz liczbę powtórzeń w każdej serii (ciężar jest opcjonalny, np. 22,5).
                  </AppText>
                ) : exerciseSets.length > 0 ? (
                  <Button
                    label="Zapisz jako szablon"
                    icon="bookmark_add"
                    variant="secondary"
                    onPress={() => setTemplateNameOpen(true)}
                  />
                ) : null}
              </Section>
            ) : null}

            <TextField
              label="Notatka"
              value={form.note}
              onChangeText={(note) => update({ note })}
              placeholder="Jak poszło? (opcjonalnie)"
              multiline
            />

            {!isNew ? <Button label="Usuń trening" variant="danger" icon="delete" onPress={remove} /> : null}
          </>
        ) : null}
      </ScrollScreen>

      <PromptSheet
        visible={templateNameOpen}
        title="Nazwa szablonu"
        placeholder="np. Push, Nogi, FBW"
        onSubmit={saveAsTemplate}
        onClose={() => setTemplateNameOpen(false)}
      />
      <ExercisePicker
        visible={exercisePickerOpen}
        excludeIds={form.exercises.map((exercise) => exercise.exerciseId)}
        onPick={addExercise}
        onClose={() => setExercisePickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeTile: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
});
