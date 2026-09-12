import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { IconBadge } from '@/components/icon-badge';
import type { Workout } from '@/db/workouts';
import { formatDuration, formatKm, plural } from '@/lib/format';
import { useTheme } from '@/theme/use-theme';

import { WORKOUT_TYPES, workoutPace } from './workout-types';

export function workoutSummary(workout: Workout) {
  return [
    workout.duration_min ? formatDuration(workout.duration_min) : null,
    workout.distance_km ? formatKm(workout.distance_km) : null,
    workoutPace(workout.type, workout.duration_min, workout.distance_km),
    workout.exercise_count ? plural(workout.exercise_count, ['ćwiczenie', 'ćwiczenia', 'ćwiczeń']) : null,
    workout.set_count ? plural(workout.set_count, ['seria', 'serie', 'serii']) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Wiersz treningu; stuknięcie domyślnie otwiera jego edycję. */
export function WorkoutRow({ workout, onPress }: { workout: Workout; onPress?: () => void }) {
  const { colors } = useTheme();
  const open = onPress ?? (() => router.push({ pathname: '/trening/[id]', params: { id: String(workout.id) } }));
  const type = WORKOUT_TYPES[workout.type];

  return (
    <Card variant="row" onPress={open}>
      <IconBadge icon={type.icon} color={colors.activity} />
      <View style={styles.body}>
        <AppText variant="bodyStrong">{type.label}</AppText>
        <AppText variant="caption" tone="textSecondary">
          {workoutSummary(workout)}
        </AppText>
        {workout.note ? (
          <AppText variant="caption" tone="textMuted" numberOfLines={1}>
            {workout.note}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: 2 },
});
