import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyLine } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Section } from '@/components/section';
import {
  DAY_HABITS_SQL,
  DAY_JOURNAL_SQL,
  DAY_TASKS_SQL,
  DAY_WORKOUTS_SQL,
  type HabitWithCount,
} from '@/db/day';
import { FINANCE_TABLES, TRANSACTIONS_RANGE_SQL, type Transaction } from '@/db/finance';
import type { JournalEntry } from '@/db/journal';
import { TASK_TABLES, type Task } from '@/db/tasks';
import { useQuery } from '@/db/use-query';
import type { Workout } from '@/db/workouts';
import { WorkoutRow } from '@/features/activity/workout-row';
import { formatMoney } from '@/features/finance/money';
import { TransactionRow } from '@/features/finance/transaction-row';
import { moodOf } from '@/features/journal/moods';
import { useModuleVisible } from '@/features/modules/preferences';
import { useTags } from '@/features/tags/tags';
import { TaskRow } from '@/features/tasks/task-row';
import type { DateKey } from '@/lib/dates';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { DayHabits, habitsForDay } from './day-habits';

type Props = {
  date: DateKey;
  today: DateKey;
  /** compact — podsumowanie pod kalendarzem, full — ekran pojedynczego dnia. */
  variant: 'compact' | 'full';
};

/** Wszystko z jednego dnia: dziennik, nawyki, zadania i treningi. */
export function DayAgenda({ date, today, variant }: Props) {
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
    TASK_TABLES,
  );
  const { byId: tagsById } = useTags();
  const { rows: workouts } = useQuery<Workout>(DAY_WORKOUTS_SQL, { $date: date }, ['workouts', 'workout_sets']);

  const { rows: transactions } = useQuery<Transaction>(TRANSACTIONS_RANGE_SQL, { $from: date, $to: date }, FINANCE_TABLES);
  const financeVisible = useModuleVisible('finanse');
  const spent = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);

  const journal = journalRows[0] ?? null;
  const habitsDone = habits.filter((habit) => habit.count >= habit.target_per_day).length;

  return (
    <View style={styles.container}>
      {isPast ? (
        <Section icon="auto_stories" color={colors.journal} title="Dziennik">
          <JournalCard entry={journal} full={full} onPress={() => router.push({ pathname: '/dziennik/[date]', params: { date } })} />
        </Section>
      ) : null}

      {isPast && habits.length > 0 ? (
        <Section icon="check_circle" color={colors.habits} title="Nawyki" meta={`${habitsDone} z ${habits.length}`}>
          <DayHabits habits={habits} date={date} today={today} variant={full ? 'rows' : 'chips'} />
        </Section>
      ) : null}

      <Section
        icon="checklist"
        color={colors.tasks}
        title="Zadania"
        onAdd={full ? () => router.push({ pathname: '/zadanie/[id]', params: { id: 'nowe', due: date } }) : undefined}>
        {tasks.length ? (
          tasks.map((task) => (
            <TaskRow key={task.id} task={task} today={today} tagsById={tagsById} />
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
            <WorkoutRow key={workout.id} workout={workout} />
          ))
        ) : (
          <EmptyLine text="Brak treningów" />
        )}
      </Section>

      {/* Wydatki tylko w pełnym widoku dnia — na ekranie Dziś jest do nich skrót. */}
      {full && isPast && financeVisible ? (
        <Section
          icon="payments"
          color={colors.finance}
          title="Wydatki"
          meta={spent ? `−${formatMoney(spent)}` : undefined}
          onAdd={() => router.push({ pathname: '/finanse/transakcja/[id]', params: { id: 'nowa', date } })}>
          {transactions.length ? (
            transactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)
          ) : (
            <EmptyLine text="Brak wydatków" />
          )}
        </Section>
      ) : null}
    </View>
  );
}

function JournalCard({ entry, full, onPress }: { entry: JournalEntry | null; full: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const mood = moodOf(entry?.mood ?? null);

  return (
    <Card onPress={onPress} style={styles.journal}>
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
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },
  flex: { flex: 1 },
  journal: { gap: spacing.sm },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  moodEmoji: { fontSize: 28 },
});
