import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyLine } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { DAY_HABITS_SQL, DAY_JOURNAL_SQL, DAY_TASKS_SQL, type HabitWithCount } from '@/db/day';
import type { JournalEntry } from '@/db/journal';
import { getSetting, setSetting } from '@/db/settings';
import { TASK_TABLES, createQuickTask, moveOpenTasksToNextDay, type Task } from '@/db/tasks';
import { useQuery, useSetting } from '@/db/use-query';
import { DayHabits, habitsForDay } from '@/features/day/day-habits';
import { JournalEditor } from '@/features/journal/journal-editor';
import { moodOf } from '@/features/journal/moods';
import { useTags } from '@/features/tags/tags';
import { TaskRow } from '@/features/tasks/task-row';
import { addDays, formatDayLong, isDateKey } from '@/lib/dates';
import { plural } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/**
 * Wieczorne podsumowanie dnia (/podsumowanie, opcjonalnie ?date=…): odhaczenie nawyków,
 * zadania na dziś (z przeniesieniem niezrobionych na jutro), nastrój i wpis, plan na jutro.
 */
export default function ReviewScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();
  const date = isDateKey(params.date) ? params.date : today;
  const tomorrow = addDays(date, 1);
  const [newTask, setNewTask] = useState('');
  const { byId: tagsById } = useTags();

  const { rows: allHabits } = useQuery<HabitWithCount>(DAY_HABITS_SQL, { $date: date }, ['habits', 'habit_logs']);
  const habits = habitsForDay(allHabits, date);
  const { rows: todayTasks } = useQuery<Task>(DAY_TASKS_SQL, { $date: date, $withOverdue: 1 }, TASK_TABLES);
  const { rows: tomorrowTasks } = useQuery<Task>(DAY_TASKS_SQL, { $date: tomorrow, $withOverdue: 0 }, TASK_TABLES);
  const { rows: journalRows } = useQuery<JournalEntry>(DAY_JOURNAL_SQL, { $date: date }, ['journal_entries']);

  const habitsDone = habits.filter((habit) => habit.count >= habit.target_per_day).length;
  const tasksDone = todayTasks.filter((task) => task.completed_at !== null).length;
  const movable = todayTasks.filter((task) => task.completed_at === null && task.repeat === null).length;
  const reviewed = useSetting('last_review_date') === date;

  const moveToTomorrow = () =>
    Alert.alert('Przenieść na jutro?', `${plural(movable, ['zadanie', 'zadania', 'zadań'])} dostanie termin na jutro.`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Przenieś', onPress: () => void moveOpenTasksToNextDay(db, date) },
    ]);

  const addTomorrowTask = async () => {
    const title = newTask.trim();
    if (!title) return;
    setNewTask('');
    await createQuickTask(db, title, tomorrow);
  };

  const finish = async () => {
    // Licznik zamkniętych dni (do osiągnięć) rośnie tylko przy pierwszym podsumowaniu danego dnia.
    if (!reviewed) {
      const count = Number(await getSetting(db, 'review_count')) || 0;
      await setSetting(db, 'review_count', String(count + 1));
    }
    await setSetting(db, 'last_review_date', date);
    await db.runAsync('INSERT OR IGNORE INTO daily_reviews (date) VALUES (?)', date);
    const mood = moodOf(journalRows[0]?.mood ?? null);
    const summary = [
      habits.length ? `Nawyki: ${habitsDone} z ${habits.length}` : null,
      `Zadania: ${plural(tasksDone, ['zrobione', 'zrobione', 'zrobionych'])}`,
      mood ? `Nastrój: ${mood.emoji} ${mood.label}` : null,
      tomorrowTasks.length ? `Na jutro: ${plural(tomorrowTasks.length, ['zadanie', 'zadania', 'zadań'])}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    Alert.alert('Dzień zamknięty 🌙', summary, [{ text: 'Dobranoc', onPress: () => router.back() }]);
  };

  return (
    <ScrollScreen title="Podsumowanie dnia">
      <View style={styles.intro}>
        <AppText variant="heading">Jak minął dzień?</AppText>
        <AppText tone="textSecondary">
          {formatDayLong(date)}
          {reviewed ? ' · już podsumowany ✓' : ''}
        </AppText>
      </View>

      <Section icon="check_circle" color={colors.habits} title="Nawyki" meta={habits.length ? `${habitsDone} z ${habits.length}` : undefined}>
        {habits.length ? (
          <DayHabits habits={habits} date={date} today={today} variant="rows" />
        ) : (
          <EmptyLine text="Na dziś nie ma zaplanowanych nawyków." />
        )}
      </Section>

      <Section
        icon="checklist"
        color={colors.tasks}
        title="Zadania na dziś"
        meta={todayTasks.length ? `${tasksDone} z ${todayTasks.length}` : undefined}>
        {todayTasks.length ? (
          todayTasks.map((task) => (
            <TaskRow key={task.id} task={task} today={today} tagsById={tagsById} />
          ))
        ) : (
          <EmptyLine text="Nic na dziś — czysta karta." />
        )}
        {movable > 0 ? (
          <Button label={`Przenieś niezrobione na jutro (${movable})`} icon="arrow_forward" variant="secondary" onPress={moveToTomorrow} />
        ) : null}
      </Section>

      <Section icon="auto_stories" color={colors.journal} title="Nastrój i wpis">
        <JournalEditor key={date} date={date} compact />
      </Section>

      <Section icon="event_upcoming" color={colors.tasks} title="Plan na jutro" meta={tomorrowTasks.length ? String(tomorrowTasks.length) : undefined}>
        {tomorrowTasks.map((task) => (
          <TaskRow key={task.id} task={task} today={today} tagsById={tagsById} />
        ))}
        <View style={[styles.addRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="add" size={20} color={colors.textMuted} />
          <TextInput
            value={newTask}
            onChangeText={setNewTask}
            placeholder="Dodaj zadanie na jutro"
            placeholderTextColor={colors.textMuted}
            cursorColor={colors.accent}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={addTomorrowTask}
            style={[styles.addInput, { color: colors.text }]}
          />
        </View>
      </Section>

      <Button label={reviewed ? 'Zapisz podsumowanie' : 'Zakończ dzień'} icon="done_all" onPress={finish} />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.xs },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  addInput: { flex: 1, fontSize: 16 },
});
