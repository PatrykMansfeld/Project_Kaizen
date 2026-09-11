import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useQuery } from '@/db/use-query';
import { WORKOUTS_SQL, WORKOUT_TOTALS_SQL, type Workout, type WorkoutTotals } from '@/db/workouts';
import { WorkoutRow } from '@/features/activity/workout-row';
import { WORKOUT_TYPES, WORKOUT_TYPE_KEYS, type WorkoutType } from '@/features/activity/workout-types';
import { formatDayLong, relativeDayLabel, weekOf, type DateKey } from '@/lib/dates';
import { formatDecimal, formatDuration } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

export default function ActivityScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const week = weekOf(today);
  const [typeFilter, setTypeFilter] = useState<WorkoutType | null>(null);

  const { rows: workouts, loaded } = useQuery<Workout>(WORKOUTS_SQL, { $type: typeFilter }, [
    'workouts',
    'workout_sets',
  ]);
  const { rows: totalsRows } = useQuery<WorkoutTotals>(
    WORKOUT_TOTALS_SQL,
    { $from: week[0], $to: week[6] },
    ['workouts'],
  );
  const totals = totalsRows[0] ?? { count: 0, minutes: 0, km: 0 };

  // Lista jest posortowana po dacie, więc wystarczy grupować kolejne wiersze.
  const sections: { date: DateKey; data: Workout[] }[] = [];
  for (const workout of workouts) {
    const last = sections[sections.length - 1];
    if (last?.date === workout.date) last.data.push(workout);
    else sections.push({ date: workout.date, data: [workout] });
  }

  const openWorkout = (id: number | 'nowy') =>
    router.push({ pathname: '/trening/[id]', params: { id: String(id) } });

  return (
    <Screen
      title="Aktywność"
      headerRight={
        <View style={styles.headerActions}>
          <IconButton icon="monitor_weight" accessibilityLabel="Pomiary ciała" onPress={() => router.push('/pomiary')} />
          <IconButton icon="add" variant="filled" accessibilityLabel="Nowy trening" onPress={() => openWorkout('nowy')} />
        </View>
      }>
      <SectionList
        sections={sections}
        keyExtractor={(workout) => String(workout.id)}
        renderItem={({ item }) => <WorkoutRow workout={item} onPress={() => openWorkout(item.id)} />}
        renderSectionHeader={({ section }) => (
          <AppText variant="label" tone="textSecondary" style={styles.sectionHeader}>
            {relativeDayLabel(section.date, today) ?? formatDayLong(section.date)}
          </AppText>
        )}
        ItemSeparatorComponent={Separator}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.summary, { backgroundColor: colors.surface }]}>
              <AppText variant="label" tone="textSecondary">
                Ten tydzień
              </AppText>
              <View style={styles.stats}>
                <Stat label="Treningi" value={String(totals.count)} />
                <Stat label="Czas" value={formatDuration(totals.minutes)} />
                <Stat label="Dystans" value={`${formatDecimal(totals.km, 1)} km`} />
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Chip label="Wszystkie" selected={typeFilter === null} onPress={() => setTypeFilter(null)} />
              {WORKOUT_TYPE_KEYS.map((type) => (
                <Chip
                  key={type}
                  label={WORKOUT_TYPES[type].label}
                  icon={WORKOUT_TYPES[type].icon}
                  iconColor={colors.activity}
                  selected={typeFilter === type}
                  onPress={() => setTypeFilter(type)}
                />
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          loaded ? (
            <EmptyState
              icon="directions_run"
              color={colors.activity}
              title={typeFilter ? `Brak treningów: ${WORKOUT_TYPES[typeFilter].label.toLowerCase()}` : 'Brak treningów'}
              description="Dodaj trening przyciskiem +."
            />
          ) : null
        }
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="heading">{value}</AppText>
      <AppText variant="caption" tone="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  list: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { gap: spacing.md, paddingBottom: spacing.xs },
  summary: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.md },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, gap: 2 },
  filters: { gap: spacing.sm },
  sectionHeader: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  separator: { height: spacing.sm },
});
