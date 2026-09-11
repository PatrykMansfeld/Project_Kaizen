import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import {
  DAY_HABITS_SQL,
  DAY_JOURNAL_SQL,
  DAY_TASKS_SQL,
  DAY_WORKOUTS_SQL,
  type HabitWithCount,
} from '@/db/day';
import type { JournalEntry } from '@/db/journal';
import { TASK_TABLES, toggleTask, type Task } from '@/db/tasks';
import { useQuery } from '@/db/use-query';
import type { Workout } from '@/db/workouts';
import { WorkoutRow } from '@/features/activity/workout-row';
import { moodOf } from '@/features/journal/moods';
import { useTags } from '@/features/tags/tags';
import { TaskRow } from '@/features/tasks/task-row';
import type { DateKey } from '@/lib/dates';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { DayHabits, DaySection, habitsForDay } from './day-habits';

type Props = {
  date: DateKey;
  today: DateKey;
  /** compact — podsumowanie pod kalendarzem, full — ekran pojedynczego dnia. */
  variant: 'compact' | 'full';
};

/** Wszystko z jednego dnia: dziennik, nawyki, zadania i treningi. */
export function DayAgenda({ date, today, variant }: Props) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const full = variant === 'full';
  // Przyszłości nie da się odhaczyć ani opisać w dzienniku.
  const isPast = date <= today;

  const { rows: journalRows } = useQuery<JournalEntry>(DAY_JOURNAL_SQL, { $date: date }, ['journal_entries']);
  const { rows: allHabits } = useQuery<HabitWithCount>(DAY_HABITS_SQL, { $date: date }, ['habits', 'habit_logs']);
  const habits = habitsForDay(allHabits, date);
  const { rows: tasks } = useQuery<Task>(
    DAY_TASKS_SQL,
    { $date: date, $withOverdue: date === today ? 1 : 0 },
    [...TASK_TABLES],
  );
  const { byId: tagsById } = useTags();
  const { rows: workouts } = useQuery<Workout>(DAY_WORKOUTS_SQL, { $date: date }, ['workouts', 'workout_sets']);

  const journal = journalRows[0] ?? null;
  const habitsDone = habits.filter((habit) => habit.count >= habit.target_per_day).length;

  return (
    <View style={styles.container}>
      {isPast ? (
        <DaySection icon="auto_stories" color={colors.journal} title="Dziennik">
          <JournalCard entry={journal} full={full} onPress={() => router.push({ pathname: '/dziennik/[date]', params: { date } })} />
        </DaySection>
      ) : null}

      {isPast && habits.length > 0 ? (
        <DaySection icon="check_circle" color={colors.habits} title="Nawyki" meta={`${habitsDone} z ${habits.length}`}>
          <DayHabits habits={habits} date={date} today={today} variant={full ? 'rows' : 'chips'} />
        </DaySection>
      ) : null}

      <DaySection
        icon="checklist"
        color={colors.tasks}
        title="Zadania"
        onAdd={full ? () => router.push({ pathname: '/zadanie/[id]', params: { id: 'nowe', due: date } }) : undefined}>
        {tasks.length ? (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              tagsById={tagsById}
              onPress={() => router.push({ pathname: '/zadanie/[id]', params: { id: String(task.id) } })}
              onToggle={() => toggleTask(db, task, today)}
            />
          ))
        ) : (
          <EmptyLine text="Brak zadań na ten dzień" />
        )}
      </DaySection>

      <DaySection
        icon="directions_run"
        color={colors.activity}
        title="Aktywność"
        onAdd={full ? () => router.push({ pathname: '/trening/[id]', params: { id: 'nowy', date } }) : undefined}>
        {workouts.length ? (
          workouts.map((workout) => (
            <WorkoutRow
              key={workout.id}
              workout={workout}
              onPress={() => router.push({ pathname: '/trening/[id]', params: { id: String(workout.id) } })}
            />
          ))
        ) : (
          <EmptyLine text="Brak treningów" />
        )}
      </DaySection>
    </View>
  );
}

function JournalCard({ entry, full, onPress }: { entry: JournalEntry | null; full: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const mood = moodOf(entry?.mood ?? null);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={[styles.journal, { backgroundColor: colors.surface }]}>
      {entry ? (
        <>
          {mood ? (
            <View style={styles.moodRow}>
              <Text style={styles.moodEmoji}>{mood.emoji}</Text>
              <AppText variant="bodyStrong">{mood.label}</AppText>
            </View>
          ) : null}
          {entry.body ? (
            <AppText tone="textSecondary" numberOfLines={full ? undefined : 2}>
              {entry.body}
            </AppText>
          ) : null}
        </>
      ) : (
        <View style={styles.moodRow}>
          <Icon name="edit_note" color={colors.journal} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Jak minął dzień?</AppText>
            <AppText variant="caption" tone="textSecondary">
              Dotknij, żeby dodać nastrój i wpis
            </AppText>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function EmptyLine({ text }: { text: string }) {
  return (
    <AppText variant="caption" tone="textMuted" style={styles.emptyLine}>
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },
  flex: { flex: 1 },
  journal: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.md, overflow: 'hidden' },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  moodEmoji: { fontSize: 28 },
  emptyLine: { paddingVertical: spacing.xs },
});
