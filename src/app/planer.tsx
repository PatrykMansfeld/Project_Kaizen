import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { PeriodNavigator } from '@/components/period-navigator';
import { PromptSheet } from '@/components/prompt-sheet';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import {
  TASKS_BETWEEN_SQL,
  TASKS_OVERDUE_BEFORE_SQL,
  TASKS_UNDATED_SQL,
  TASK_TABLES,
  createQuickTask,
  setTaskDue,
  type Task,
} from '@/db/tasks';
import { useQuery } from '@/db/use-query';
import { useTags } from '@/features/tags/tags';
import { TaskRow } from '@/features/tasks/task-row';
import { groupBy } from '@/lib/collections';
import { WEEKDAYS, WEEKDAYS_SHORT, addDays, formatDateRange, fromDateKey, startOfWeek, weekOf, type DateKey } from '@/lib/dates';
import { capitalize, plural } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Ile zadań bez terminu pokazać przed „Pokaż wszystkie”. */
const UNDATED_PREVIEW = 5;

/** „Zadanie na środę” — dni tygodnia w bierniku. */
const WEEKDAYS_ACCUSATIVE = ['poniedziałek', 'wtorek', 'środę', 'czwartek', 'piątek', 'sobotę', 'niedzielę'];

function dayMonth(day: DateKey) {
  const date = fromDateKey(day);
  return `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Planer tygodnia: zadania rozłożone na dni (z godzinami), zaległe i te bez terminu. Stuknięcie w zadanie
 * pozwala przestawić je na inny dzień lub godzinę; „+” przy dniu dodaje zadanie od razu na ten dzień.
 */
export default function PlannerScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const { byId: tagsById } = useTags();
  const [monday, setMonday] = useState(() => startOfWeek(today));
  const [planning, setPlanning] = useState<Task | null>(null);
  const [addingTo, setAddingTo] = useState<DateKey | null>(null);
  const [allUndated, setAllUndated] = useState(false);
  const db = useSQLiteContext();

  const days = weekOf(monday);
  const sunday = days[6];
  const currentWeek = startOfWeek(today);
  const isCurrentWeek = monday === currentWeek;

  const { rows: weekTasks } = useQuery<Task>(TASKS_BETWEEN_SQL, { $from: monday, $to: sunday }, TASK_TABLES);
  const { rows: undated } = useQuery<Task>(TASKS_UNDATED_SQL, [], TASK_TABLES);
  const { rows: overdue } = useQuery<Task>(TASKS_OVERDUE_BEFORE_SQL, { $from: currentWeek }, TASK_TABLES);
  const byDay = groupBy(weekTasks, (task) => task.due_date!);
  const openCount = weekTasks.filter((task) => task.completed_at === null).length;
  const doneCount = weekTasks.length - openCount;

  const addTask = (title: string) => {
    const text = title.trim();
    if (text && addingTo) void createQuickTask(db, text, addingTo);
  };

  const row = (task: Task) => <TaskRow key={task.id} task={task} today={today} tagsById={tagsById} onPress={() => setPlanning(task)} />;

  return (
    <ScrollScreen title="Planer tygodnia" gap={spacing.lg}>
      <PeriodNavigator
        title={formatDateRange(monday, sunday, today)}
        subtitle={
          isCurrentWeek ? (
            'Ten tydzień'
          ) : (
            <Chip label="Wróć do tego tygodnia" icon="today" selected={false} onPress={() => setMonday(currentWeek)} />
          )
        }
        onPrevious={() => setMonday(addDays(monday, -7))}
        onNext={() => setMonday(addDays(monday, 7))}
        unitLabel={{ previous: 'Poprzedni tydzień', next: 'Następny tydzień' }}
      />
      <AppText variant="caption" tone="textSecondary">
        {weekTasks.length
          ? `${plural(openCount, ['zadanie do zrobienia', 'zadania do zrobienia', 'zadań do zrobienia'])} · zrobione ${doneCount}`
          : 'Na ten tydzień nic nie ma — stuknij „+” przy dniu albo zaplanuj coś spod „Bez terminu”.'}
      </AppText>

      {isCurrentWeek && overdue.length > 0 ? (
        <Section title="Zaległe z poprzednich tygodni" icon="history" color={colors.danger} meta={String(overdue.length)}>
          {overdue.map(row)}
        </Section>
      ) : null}

      {days.map((day, index) => {
        const tasks = byDay.get(day) ?? [];
        const open = tasks.filter((task) => task.completed_at === null).length;
        const isToday = day === today;
        return (
          <Section
            key={day}
            title={`${capitalize(WEEKDAYS[index])} ${dayMonth(day)}${isToday ? ' · dziś' : ''}`}
            icon={isToday ? 'today' : undefined}
            color={isToday ? colors.accent : undefined}
            meta={tasks.length ? `${open} / ${tasks.length}` : undefined}
            onAdd={() => setAddingTo(day)}>
            {tasks.length ? (
              tasks.map(row)
            ) : (
              <AppText variant="caption" tone="textMuted">
                {day < today ? 'Nic nie było zaplanowane.' : 'Wolne.'}
              </AppText>
            )}
          </Section>
        );
      })}

      <Section title="Bez terminu" icon="inbox" color={colors.textMuted} meta={undated.length ? String(undated.length) : undefined}>
        {undated.length === 0 ? (
          <AppText variant="caption" tone="textMuted">
            Wszystko ma swój dzień.
          </AppText>
        ) : null}
        {(allUndated ? undated : undated.slice(0, UNDATED_PREVIEW)).map(row)}
        {undated.length > UNDATED_PREVIEW ? (
          <Pressable onPress={() => setAllUndated(!allUndated)} hitSlop={8} accessibilityRole="button">
            <AppText variant="caption" tone="accent">
              {allUndated ? 'Pokaż mniej' : `Pokaż wszystkie (${undated.length})`}
            </AppText>
          </Pressable>
        ) : null}
      </Section>

      <BottomSheet visible={planning !== null} onClose={() => setPlanning(null)}>
        {planning ? <PlanContent task={planning} days={days} today={today} onClose={() => setPlanning(null)} /> : null}
      </BottomSheet>
      <PromptSheet
        visible={addingTo !== null}
        title={addingTo ? `Zadanie na ${WEEKDAYS_ACCUSATIVE[days.indexOf(addingTo)] ?? 'ten dzień'}` : ''}
        placeholder="np. Zadzwonić do mechanika"
        onSubmit={addTask}
        onClose={() => setAddingTo(null)}
      />
    </ScrollScreen>
  );
}

/** Na który dzień i o której: dni oglądanego tygodnia, następny tydzień albo bez terminu. */
function PlanContent({ task, days, today, onClose }: { task: Task; days: DateKey[]; today: DateKey; onClose: () => void }) {
  const db = useSQLiteContext();
  const [day, setDay] = useState<DateKey | null>(task.due_date);
  const [time, setTime] = useState<string | null>(task.due_time);
  const [timeOpen, setTimeOpen] = useState(false);
  const nextMonday = addDays(days[0], 7);

  const save = async () => {
    await setTaskDue(db, task.id, day, day ? time : null);
    onClose();
  };

  const openTask = () => {
    onClose();
    router.push({ pathname: '/zadanie/[id]', params: { id: String(task.id) } });
  };

  return (
    <>
      <View style={styles.sheetTitle}>
        <AppText variant="heading" numberOfLines={2}>
          {task.title}
        </AppText>
        <AppText tone="textSecondary">Na kiedy?</AppText>
      </View>
      <ChipRow>
        {days.map((option, index) => (
          <Chip
            key={option}
            label={`${WEEKDAYS_SHORT[index]} ${dayMonth(option)}${option === today ? ' · dziś' : ''}`}
            selected={day === option}
            onPress={() => setDay(option)}
          />
        ))}
        <Chip label={`Pn ${dayMonth(nextMonday)}`} icon="arrow_forward" selected={day === nextMonday} onPress={() => setDay(nextMonday)} />
        <Chip label="Bez terminu" selected={day === null} onPress={() => setDay(null)} />
      </ChipRow>
      {day ? (
        <ChipRow>
          <Chip label="Bez godziny" selected={time === null} onPress={() => setTime(null)} />
          <Chip label={time ? `Godzina ${time}` : 'Godzina…'} icon="schedule" selected={time !== null} onPress={() => setTimeOpen(true)} />
        </ChipRow>
      ) : null}
      {task.repeat && day === null ? (
        <AppText variant="caption" tone="warning">
          Bez terminu zadanie przestanie się powtarzać.
        </AppText>
      ) : null}
      <SheetActions>
        <Button label="Otwórz" icon="open_in_new" variant="secondary" onPress={openTask} />
        <Button label="Zapisz" onPress={save} />
      </SheetActions>
      <TimePickerSheet visible={timeOpen} title="Godzina" value={time} onChange={setTime} onClose={() => setTimeOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  sheetTitle: { gap: spacing.xs },
});
