import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { DateChoice } from '@/components/date-choice';
import { DatePickerSheet } from '@/components/date-picker-sheet';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { createGoal, deleteGoal, getGoal, updateGoal, type GoalInput, type GoalKind } from '@/db/goals';
import { HABITS_SQL, type Habit } from '@/db/habits';
import {
  MEASUREMENT_TYPES,
  MEASUREMENT_TYPE_KEYS,
  getLatestMeasurement,
  type MeasurementType,
} from '@/db/measurements';
import { useQuery } from '@/db/use-query';
import { WORKOUT_TYPES, WORKOUT_TYPE_KEYS, type WorkoutType } from '@/features/activity/workout-types';
import { GOAL_KINDS, GOAL_KIND_KEYS } from '@/features/goals/goal-format';
import { confirmDelete } from '@/lib/alerts';
import { addDays, addMonths, formatDayShort, fromDateKey, toDateKey, type DateKey } from '@/lib/dates';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { useToday } from '@/lib/use-today';

/** Jednostka pola „cel” w formularzu (dla czasu wpisujemy godziny, w bazie są minuty). */
function targetLabel(kind: GoalKind, measurement: MeasurementType, unit: string) {
  switch (kind) {
    case 'distance':
      return 'Cel (km)';
    case 'workouts':
      return 'Cel (liczba treningów)';
    case 'minutes':
      return 'Cel (godziny)';
    case 'habit':
      return 'Cel (liczba dni)';
    case 'measurement':
      return `Wartość docelowa (${MEASUREMENT_TYPES[measurement].unit})`;
    case 'manual':
      return `Cel${unit.trim() ? ` (${unit.trim()})` : ''}`;
  }
}

/** Nowy cel: /cel/nowy, edycja: /cel/5. */
export default function GoalEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowy';
  const goalId = Number(id);

  const db = useSQLiteContext();
  const today = useToday();
  const { rows: habits } = useQuery<Habit>(HABITS_SQL, [], ['habits']);

  const endOfMonth = toDateKey(new Date(fromDateKey(today).getFullYear(), fromDateKey(today).getMonth() + 1, 0));
  const endOfYear = `${today.slice(0, 4)}-12-31`;

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<GoalKind>('distance');
  const [workoutType, setWorkoutType] = useState<WorkoutType | null>(null);
  const [habitId, setHabitId] = useState<number | null>(null);
  const [measurement, setMeasurement] = useState<MeasurementType>('weight');
  const [startText, setStartText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [unit, setUnit] = useState('');
  const [startDate, setStartDate] = useState<DateKey>(today);
  const [endDate, setEndDate] = useState<DateKey>(endOfMonth);
  const [loaded, setLoaded] = useState(isNew);
  const [startPickerOpen, setStartPickerOpen] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getGoal(db, goalId).then((goal) => {
      if (!goal) {
        router.back();
        return;
      }
      setTitle(goal.title);
      setKind(goal.kind);
      setWorkoutType(goal.workout_type);
      setHabitId(goal.habit_id);
      if (goal.measurement_type) setMeasurement(goal.measurement_type);
      setStartText(goal.start_value !== null ? formatDecimal(goal.start_value, 1) : '');
      setTargetText(formatDecimal(goal.kind === 'minutes' ? goal.target / 60 : goal.target, 1));
      setUnit(goal.unit ?? '');
      setStartDate(goal.start_date);
      setEndDate(goal.end_date);
      setLoaded(true);
    });
  }, [db, isNew, goalId]);

  // Cel „pomiar”: start podpowiada się z ostatniego pomiaru.
  useEffect(() => {
    if (!isNew || kind !== 'measurement') return;
    getLatestMeasurement(db, measurement).then((latest) => {
      if (latest) setStartText(formatDecimal(latest.value, 1));
    });
  }, [db, isNew, kind, measurement]);

  const target = parseDecimal(targetText);
  const start = parseDecimal(startText);
  const valid =
    title.trim().length > 0 &&
    target !== null &&
    target > 0 &&
    endDate >= startDate &&
    (kind !== 'habit' || habitId !== null) &&
    (kind !== 'measurement' || (start !== null && start > 0 && start !== target)) &&
    (kind !== 'manual' || unit.trim().length > 0);
  const canSave = loaded && valid;

  const save = async () => {
    if (!canSave || target === null) return;
    const input: GoalInput = {
      title: title.trim(),
      kind,
      workout_type: ['distance', 'workouts', 'minutes'].includes(kind) ? workoutType : null,
      habit_id: kind === 'habit' ? habitId : null,
      measurement_type: kind === 'measurement' ? measurement : null,
      start_value: kind === 'measurement' ? start : null,
      target: kind === 'minutes' ? Math.round(target * 60) : target,
      unit: kind === 'manual' ? unit.trim() : null,
      start_date: startDate,
      end_date: endDate,
    };
    if (isNew) await createGoal(db, input);
    else await updateGoal(db, goalId, input);
    router.back();
  };

  const remove = () =>
    confirmDelete('Usunąć cel?', title, async () => {
      await deleteGoal(db, goalId);
      router.back();
    });

  return (
    <>
      <ScrollScreen title={isNew ? 'Nowy cel' : 'Cel'} headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
        {loaded ? (
          <>
            <TextField label="Nazwa" value={title} onChangeText={setTitle} placeholder="np. 100 km biegu we wrześniu" autoFocus={isNew} />

            <Section title="Co liczymy">
              <ChipRow>
                {GOAL_KIND_KEYS.map((key) => (
                  <Chip key={key} label={GOAL_KINDS[key].label} icon={GOAL_KINDS[key].icon} selected={kind === key} onPress={() => setKind(key)} />
                ))}
              </ChipRow>
              <AppText variant="caption" tone="textMuted">
                {GOAL_KINDS[kind].hint}
              </AppText>
            </Section>

            {kind === 'distance' || kind === 'workouts' || kind === 'minutes' ? (
              <Section title="Rodzaj treningu">
                <ChipRow>
                  <Chip label="Wszystkie" selected={workoutType === null} onPress={() => setWorkoutType(null)} />
                  {WORKOUT_TYPE_KEYS.filter((type) => kind !== 'distance' || WORKOUT_TYPES[type].hasDistance).map((type) => (
                    <Chip key={type} label={WORKOUT_TYPES[type].label} selected={workoutType === type} onPress={() => setWorkoutType(type)} />
                  ))}
                </ChipRow>
              </Section>
            ) : null}

            {kind === 'habit' ? (
              <Section title="Nawyk">
                {habits.length ? (
                  <ChipRow>
                    {habits.map((habit) => (
                      <Chip key={habit.id} label={`${habit.icon} ${habit.name}`} selected={habitId === habit.id} onPress={() => setHabitId(habit.id)} />
                    ))}
                  </ChipRow>
                ) : (
                  <AppText variant="caption" tone="textMuted">
                    Najpierw dodaj nawyk w zakładce Nawyki.
                  </AppText>
                )}
              </Section>
            ) : null}

            {kind === 'measurement' ? (
              <>
                <Section title="Pomiar">
                  <ChipRow>
                    {MEASUREMENT_TYPE_KEYS.map((key) => (
                      <Chip key={key} label={MEASUREMENT_TYPES[key].label} selected={measurement === key} onPress={() => setMeasurement(key)} />
                    ))}
                  </ChipRow>
                </Section>
                <TextField
                  label={`Wartość na start (${MEASUREMENT_TYPES[measurement].unit})`}
                  value={startText}
                  onChangeText={setStartText}
                  placeholder="np. 82"
                  keyboardType="decimal-pad"
                  maxLength={6}
                />
              </>
            ) : null}

            {kind === 'manual' ? (
              <TextField label="Jednostka" value={unit} onChangeText={setUnit} placeholder="np. książek, kursów, km" maxLength={16} />
            ) : null}

            <TextField
              label={targetLabel(kind, measurement, unit)}
              value={targetText}
              onChangeText={setTargetText}
              placeholder={kind === 'measurement' ? 'np. 78' : 'np. 100'}
              keyboardType="decimal-pad"
              maxLength={8}
            />

            <Section title="Termin">
              <DateChoice
                value={endDate}
                onChange={(day) => day && setEndDate(day)}
                today={today}
                pickerTitle="Termin"
                presets={[
                  { label: 'Koniec miesiąca', date: endOfMonth },
                  { label: 'Za 30 dni', date: addDays(today, 29) },
                  { label: 'Za 3 miesiące', date: addMonths(today, 3) },
                  { label: 'Koniec roku', date: endOfYear },
                ]}
              />
              <Pressable onPress={() => setStartPickerOpen(true)} hitSlop={8} accessibilityRole="button">
                <AppText variant="caption" tone="textSecondary">
                  Liczone od: {formatDayShort(startDate, today)} (zmień)
                </AppText>
              </Pressable>
              {endDate < startDate ? (
                <AppText variant="caption" tone="danger">
                  Termin musi być po dacie startu.
                </AppText>
              ) : null}
            </Section>

            {!isNew ? <Button label="Usuń cel" variant="danger" icon="delete" onPress={remove} /> : null}
          </>
        ) : null}
      </ScrollScreen>
      <DatePickerSheet
        visible={startPickerOpen}
        title="Liczone od"
        today={today}
        value={startDate}
        onChange={(day) => day && setStartDate(day)}
        onClose={() => setStartPickerOpen(false)}
        clearable={false}
      />
    </>
  );
}
