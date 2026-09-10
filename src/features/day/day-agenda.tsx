import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import {
  DAY_HABITS_SQL,
  DAY_JOURNAL_SQL,
  DAY_TASKS_SQL,
  DAY_WORKOUTS_SQL,
  type HabitWithCount,
} from '@/db/day';
import { nextHabitCount, setHabitCount } from '@/db/habits';
import type { JournalEntry } from '@/db/journal';
import { setTaskDone, type Task } from '@/db/tasks';
import { useQuery } from '@/db/use-query';
import type { Workout } from '@/db/workouts';
import { WorkoutRow } from '@/features/activity/workout-row';
import { HabitIcon, HabitProgressButton } from '@/features/habits/habit-card';
import { habitColor } from '@/features/habits/palette';
import { moodOf } from '@/features/journal/moods';
import { TaskRow } from '@/features/tasks/task-row';
import type { DateKey } from '@/lib/dates';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  date: DateKey;
  today: DateKey;
  /** compact — podsumowanie pod kalendarzem, full — ekran pojedynczego dnia. */
  variant: 'compact' | 'full';
};

/** Wszystko z jednego dnia: dziennik, nawyki, zadania i treningi. */
export function DayAgenda({ date, today, variant }: Props) {
  const db = useSQLiteContext();
  const { colors, dark } = useTheme();
  const full = variant === 'full';
  // Przyszłości nie da się odhaczyć ani opisać w dzienniku.
  const isPast = date <= today;

  const { rows: journalRows } = useQuery<JournalEntry>(DAY_JOURNAL_SQL, { $date: date }, ['journal_entries']);
  const { rows: habits } = useQuery<HabitWithCount>(DAY_HABITS_SQL, { $date: date }, ['habits', 'habit_logs']);
  const { rows: tasks } = useQuery<Task>(
    DAY_TASKS_SQL,
    { $date: date, $withOverdue: date === today ? 1 : 0 },
    ['tasks'],
  );
  const { rows: workouts } = useQuery<Workout>(DAY_WORKOUTS_SQL, { $date: date }, ['workouts', 'workout_sets']);

  const journal = journalRows[0] ?? null;
  const habitsDone = habits.filter((habit) => habit.count >= habit.target_per_day).length;

  const changeHabit = (habit: HabitWithCount, count: number) => setHabitCount(db, habit.id, date, count);

  return (
    <View style={styles.container}>
      {isPast ? (
        <Section icon="auto_stories" color={colors.journal} title="Dziennik">
          <JournalCard entry={journal} full={full} onPress={() => router.push({ pathname: '/dziennik/[date]', params: { date } })} />
        </Section>
      ) : null}

      {isPast && habits.length > 0 ? (
        <Section icon="check_circle" color={colors.habits} title="Nawyki" meta={`${habitsDone} z ${habits.length}`}>
          {full ? (
            habits.map((habit) => {
              const color = habitColor(habit.color, dark);
              return (
                <View key={habit.id} style={[styles.habitRow, { backgroundColor: colors.surface }]}>
                  <HabitIcon icon={habit.icon} color={color} size={36} />
                  <AppText style={styles.flex} numberOfLines={1}>
                    {habit.name}
                  </AppText>
                  <HabitProgressButton
                    count={habit.count}
                    target={habit.target_per_day}
                    color={color}
                    size={36}
                    onPress={() => changeHabit(habit, nextHabitCount(habit.count, habit.target_per_day))}
                    onLongPress={() => habit.count > 0 && changeHabit(habit, habit.count - 1)}
                  />
                </View>
              );
            })
          ) : (
            <View style={styles.habitChips}>
              {habits.map((habit) => {
                const color = habitColor(habit.color, dark);
                const done = habit.count >= habit.target_per_day;
                return (
                  <Pressable
                    key={habit.id}
                    onPress={() => changeHabit(habit, nextHabitCount(habit.count, habit.target_per_day))}
                    onLongPress={() => habit.count > 0 && changeHabit(habit, habit.count - 1)}
                    accessibilityLabel={`${habit.name}: ${habit.count} z ${habit.target_per_day}`}
                    style={[
                      styles.habitChip,
                      {
                        backgroundColor: withAlpha(color, done ? 0.22 : 0.07),
                        borderColor: done ? color : colors.border,
                      },
                    ]}>
                    <Text style={styles.habitEmoji}>{habit.icon}</Text>
                    {done ? (
                      <Icon name="check" size={16} color={color} />
                    ) : habit.target_per_day > 1 ? (
                      <AppText variant="caption" tone="textSecondary">
                        {habit.count}/{habit.target_per_day}
                      </AppText>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </Section>
      ) : null}

      <Section
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
              onPress={() => router.push({ pathname: '/zadanie/[id]', params: { id: String(task.id) } })}
              onToggle={() => setTaskDone(db, task.id, task.completed_at === null)}
            />
          ))
        ) : (
          <EmptyLine text="Brak zadań na ten dzień" />
        )}
      </Section>

      <Section
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
      </Section>
    </View>
  );
}

type SectionProps = {
  icon: IconName;
  color: string;
  title: string;
  meta?: string;
  onAdd?: () => void;
  children: ReactNode;
};

function Section({ icon, color, title, meta, onAdd, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name={icon} size={18} color={color} />
        <AppText variant="label" tone="textSecondary" style={styles.flex}>
          {title}
        </AppText>
        {meta ? (
          <AppText variant="caption" tone="textSecondary">
            {meta}
          </AppText>
        ) : null}
        {onAdd ? <IconButton icon="add" accessibilityLabel={`Dodaj: ${title.toLowerCase()}`} onPress={onAdd} /> : null}
      </View>
      {children}
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

function EmptyLine({ text }: { text: string }) {
  return (
    <AppText variant="caption" tone="textMuted" style={styles.emptyLine}>
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },
  flex: { flex: 1 },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  journal: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.md, overflow: 'hidden' },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  moodEmoji: { fontSize: 28 },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  habitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  habitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  habitEmoji: { fontSize: 20 },
  emptyLine: { paddingVertical: spacing.xs },
});
