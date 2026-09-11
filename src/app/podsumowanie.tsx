import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { DAY_HABITS_SQL, DAY_JOURNAL_SQL, DAY_TASKS_SQL, type HabitWithCount } from '@/db/day';
import type { JournalEntry } from '@/db/journal';
import { SETTING_SQL, setSetting } from '@/db/settings';
import { TASK_TABLES, createTask, moveOpenTasksToNextDay, toggleTask, type Task } from '@/db/tasks';
import { useQuery } from '@/db/use-query';
import { EmptyLine } from '@/features/day/day-agenda';
import { DayHabits, DaySection, habitsForDay } from '@/features/day/day-habits';
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
  const insets = useSafeAreaInsets();
  const date = isDateKey(params.date) ? params.date : today;
  const tomorrow = addDays(date, 1);
  const [newTask, setNewTask] = useState('');
  const { byId: tagsById } = useTags();

  const { rows: allHabits } = useQuery<HabitWithCount>(DAY_HABITS_SQL, { $date: date }, ['habits', 'habit_logs']);
  const habits = habitsForDay(allHabits, date);
  const { rows: todayTasks } = useQuery<Task>(DAY_TASKS_SQL, { $date: date, $withOverdue: 1 }, [...TASK_TABLES]);
  const { rows: tomorrowTasks } = useQuery<Task>(DAY_TASKS_SQL, { $date: tomorrow, $withOverdue: 0 }, [...TASK_TABLES]);
  const { rows: journalRows } = useQuery<JournalEntry>(DAY_JOURNAL_SQL, { $date: date }, ['journal_entries']);
  const { rows: reviewRows } = useQuery<{ value: string }>(SETTING_SQL, { $key: 'last_review_date' }, ['settings']);

  const habitsDone = habits.filter((habit) => habit.count >= habit.target_per_day).length;
  const tasksDone = todayTasks.filter((task) => task.completed_at !== null).length;
  const movable = todayTasks.filter((task) => task.completed_at === null && task.repeat === null).length;
  const reviewed = reviewRows[0]?.value === date;

  const moveToTomorrow = () =>
    Alert.alert('Przenieść na jutro?', `${plural(movable, ['zadanie', 'zadania', 'zadań'])} dostanie termin na jutro.`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Przenieś', onPress: () => void moveOpenTasksToNextDay(db, date) },
    ]);

  const addTomorrowTask = async () => {
    const title = newTask.trim();
    if (!title) return;
    setNewTask('');
    await createTask(db, { title, notes: '', priority: 0, due_date: tomorrow, due_time: null, repeat: null });
  };

  const finish = async () => {
    await setSetting(db, 'last_review_date', date);
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
    <>
      <Stack.Screen options={{ title: 'Podsumowanie dnia' }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={styles.intro}>
          <AppText variant="heading">Jak minął dzień?</AppText>
          <AppText tone="textSecondary">
            {formatDayLong(date)}
            {reviewed ? ' · już podsumowany ✓' : ''}
          </AppText>
        </View>

        <DaySection icon="check_circle" color={colors.habits} title="Nawyki" meta={habits.length ? `${habitsDone} z ${habits.length}` : undefined}>
          {habits.length ? (
            <DayHabits habits={habits} date={date} today={today} variant="rows" />
          ) : (
            <EmptyLine text="Na dziś nie ma zaplanowanych nawyków." />
          )}
        </DaySection>

        <DaySection
          icon="checklist"
          color={colors.tasks}
          title="Zadania na dziś"
          meta={todayTasks.length ? `${tasksDone} z ${todayTasks.length}` : undefined}>
          {todayTasks.length ? (
            todayTasks.map((task) => (
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
            <EmptyLine text="Nic na dziś — czysta karta." />
          )}
          {movable > 0 ? (
            <Button label={`Przenieś niezrobione na jutro (${movable})`} icon="arrow_forward" variant="secondary" onPress={moveToTomorrow} />
          ) : null}
        </DaySection>

        <DaySection icon="auto_stories" color={colors.journal} title="Nastrój i wpis">
          <JournalEditor key={date} date={date} compact />
        </DaySection>

        <DaySection icon="event_upcoming" color={colors.tasks} title="Plan na jutro" meta={tomorrowTasks.length ? String(tomorrowTasks.length) : undefined}>
          {tomorrowTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              tagsById={tagsById}
              onPress={() => router.push({ pathname: '/zadanie/[id]', params: { id: String(task.id) } })}
              onToggle={() => toggleTask(db, task, today)}
            />
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
        </DaySection>

        <Button label={reviewed ? 'Zapisz podsumowanie' : 'Zakończ dzień'} icon="done_all" onPress={finish} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, padding: spacing.lg },
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
