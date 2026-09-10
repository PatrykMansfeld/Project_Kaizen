import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import type { Workout } from '@/db/workouts';
import { formatDuration, formatKm, plural } from '@/lib/format';
import { radius, spacing, withAlpha } from '@/theme/theme';
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

export function WorkoutRow({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const { colors } = useTheme();
  const type = WORKOUT_TYPES[workout.type];

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={[styles.row, { backgroundColor: colors.surface }]}>
      <View style={[styles.icon, { backgroundColor: withAlpha(colors.activity, 0.16) }]}>
        <Icon name={type.icon} color={colors.activity} />
      </View>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
});
