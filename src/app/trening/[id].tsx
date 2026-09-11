import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DatePickerSheet } from '@/components/date-picker-sheet';
import { Icon } from '@/components/icon';
import { PromptSheet } from '@/components/prompt-sheet';
import { TextField } from '@/components/text-field';
import { getLastSet, getWorkoutSets, replaceWorkoutSets, type Exercise } from '@/db/exercises';
import { TEMPLATES_SQL, createTemplate, getTemplateSets, type WorkoutTemplate } from '@/db/templates';
import { useQuery } from '@/db/use-query';
import { createWorkout, deleteWorkout, getWorkout, updateWorkout } from '@/db/workouts';
import {
  ExerciseEditor,
  draftsFromRows,
  newKey,
  parseDrafts,
  setDraft,
  type ExerciseDraft,
} from '@/features/activity/exercise-editor';
import { ExercisePicker } from '@/features/activity/exercise-picker';
import { WORKOUT_TYPES, WORKOUT_TYPE_KEYS, workoutPace, type WorkoutType } from '@/features/activity/workout-types';
import { addDays, formatDayShort, isDateKey, type DateKey } from '@/lib/dates';
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
  const yesterday = addDays(today, -1);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<Form>({
    type: 'run',
    date: isDateKey(params.date) ? params.date : today,
    duration: '',
    distance: '',
    note: '',
    exercises: [],
  });
  const [loaded, setLoaded] = useState(isNew);
  const [pickerOpen, setPickerOpen] = useState(false);
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
    const last = await getLastSet(db, exercise.id, isNew ? null : workoutId);
    const draft: ExerciseDraft = {
      key: newKey(),
      exerciseId: exercise.id,
      name: exercise.name,
      sets: [setDraft(last?.reps ?? null, last?.weight_kg ?? null)],
    };
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
    await db.withTransactionAsync(async () => {
      let id = workoutId;
      if (isNew) {
        id = (await createWorkout(db, input)).lastInsertRowId;
      } else {
        await updateWorkout(db, workoutId, input);
      }
      await replaceWorkoutSets(db, id, exerciseSets);
    });
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert('Usunąć trening?', undefined, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(db, workoutId);
          router.back();
        },
      },
    ]);
  };

  const customDate = form.date !== today && form.date !== yesterday;

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'Nowy trening' : 'Trening',
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

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Data
              </AppText>
              <View style={styles.chips}>
                <Chip label="Dziś" selected={form.date === today} onPress={() => update({ date: today })} />
                <Chip label="Wczoraj" selected={form.date === yesterday} onPress={() => update({ date: yesterday })} />
                <Chip
                  label={customDate ? formatDayShort(form.date, today) : 'Inna data'}
                  icon="calendar_month"
                  selected={customDate}
                  onPress={() => setPickerOpen(true)}
                />
              </View>
            </View>

            <View style={styles.section}>
              <TextField
                label="Czas trwania (min)"
                value={form.duration}
                onChangeText={(text) => update({ duration: text })}
                placeholder="np. 45"
                keyboardType="number-pad"
                maxLength={4}
              />
              <View style={styles.chips}>
                {QUICK_DURATIONS.map((minutes) => (
                  <Chip
                    key={minutes}
                    label={`${minutes} min`}
                    selected={duration === minutes}
                    onPress={() => update({ duration: String(minutes) })}
                  />
                ))}
              </View>
            </View>

            {typeInfo.hasDistance ? (
              <View style={styles.section}>
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
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <AppText variant="label" tone="textSecondary" style={styles.flex}>
                    Ćwiczenia
                  </AppText>
                  <Pressable onPress={() => router.push('/szablony')} hitSlop={8} accessibilityRole="button">
                    <AppText variant="caption" tone="accent">
                      Szablony ›
                    </AppText>
                  </Pressable>
                </View>
                {templates.length > 0 ? (
                  <View style={styles.chips}>
                    {templates.map((template) => (
                      <Chip
                        key={template.id}
                        label={template.name}
                        icon="content_copy"
                        selected={false}
                        onPress={() => applyTemplate(template.id)}
                      />
                    ))}
                  </View>
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
              </View>
            ) : null}

            <TextField
              label="Notatka"
              value={form.note}
              onChangeText={(note) => update({ note })}
              placeholder="Jak poszło? (opcjonalnie)"
              multiline
            />

            {!isNew ? (
              <Button label="Usuń trening" variant="danger" icon="delete" onPress={confirmDelete} />
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <DatePickerSheet
        visible={pickerOpen}
        title="Data treningu"
        today={today}
        value={form.date}
        onChange={(date) => date && update({ date })}
        onClose={() => setPickerOpen(false)}
        clearable={false}
      />

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
  content: { gap: spacing.xl, padding: spacing.lg },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
