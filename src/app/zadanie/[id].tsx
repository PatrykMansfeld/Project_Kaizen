import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DatePickerSheet } from '@/components/date-picker-sheet';
import { TextField } from '@/components/text-field';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import {
  PRIORITY_LABELS,
  createTask,
  deleteTask,
  getTask,
  REPEAT_LABELS,
  updateTask,
  type Priority,
  type Repeat,
  type TaskInput,
} from '@/db/tasks';
import { getSubtasks, replaceSubtasks } from '@/db/subtasks';
import { getTaskTagIds, setTaskTags } from '@/db/tags';
import { notificationsSupported, requestPermission } from '@/features/reminders/reminders';
import { TagPicker } from '@/features/tags/tags';
import { priorityColor } from '@/features/tasks/priority';
import { SubtaskList, newSubtaskKey, type SubtaskDraft } from '@/features/tasks/subtask-list';
import { addDays, formatDayShort, isDateKey, type DateKey } from '@/lib/dates';
import { useAutosave } from '@/lib/use-autosave';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const PRIORITIES: Priority[] = [0, 1, 2, 3];
const REPEATS: Repeat[] = ['daily', 'weekdays', 'weekly', 'monthly'];

/** Kroki z formularza → do bazy (puste pomijamy). */
function subtaskInputs(items: SubtaskDraft[]) {
  return items.filter((item) => item.title.trim()).map((item) => ({ title: item.title.trim(), done: item.done }));
}

/** Nowe zadanie: /zadanie/nowe (opcjonalnie ?due=2026-09-10), edycja: /zadanie/123. */
export default function TaskEditScreen() {
  const { id, due: initialDue } = useLocalSearchParams<{ id: string; due?: string }>();
  const isNew = id === 'nowe';
  const taskId = Number(id);

  const db = useSQLiteContext();
  const today = useToday();
  const tomorrow = addDays(today, 1);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<TaskInput>({
    title: '',
    notes: '',
    priority: 0,
    due_date: isDateKey(initialDue) ? initialDue : null,
    due_time: null,
    repeat: null,
  });
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(isNew);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (isNew) return;
    Promise.all([getTask(db, taskId), getSubtasks(db, taskId), getTaskTagIds(db, taskId)]).then(
      ([task, subtaskRows, taskTagIds]) => {
        if (!task) {
          router.back();
          return;
        }
        setForm({
          title: task.title,
          notes: task.notes,
          priority: task.priority,
          due_date: task.due_date,
          due_time: task.due_time,
          repeat: task.repeat,
        });
        setSubtasks(subtaskRows.map((row) => ({ key: newSubtaskKey(), title: row.title, done: row.done === 1 })));
        setTagIds(taskTagIds);
        setLoaded(true);
      },
    );
  }, [db, isNew, taskId]);

  // W istniejącym zadaniu checklista zapisuje się sama (odhaczanie kroków nie wymaga „Zapisz”).
  const { schedule: scheduleSubtasks, flush: flushSubtasks } = useAutosave<SubtaskDraft[]>(async (items) => {
    await db.withTransactionAsync(() => replaceSubtasks(db, taskId, subtaskInputs(items)));
  }, 400);

  const changeSubtasks = (items: SubtaskDraft[]) => {
    setSubtasks(items);
    if (!isNew) scheduleSubtasks(items);
  };

  const update = (patch: Partial<TaskInput>) => setForm((current) => ({ ...current, ...patch }));
  const canSave = loaded && form.title.trim().length > 0;

  // Powtarzanie potrzebuje terminu: bez daty startuje od dziś, a usunięcie daty wyłącza powtarzanie.
  const setRepeat = (repeat: Repeat | null) => update({ repeat, due_date: repeat && !form.due_date ? today : form.due_date });
  const setDue = (due_date: DateKey | null) =>
    update(due_date ? { due_date } : { due_date, repeat: null, due_time: null });

  const setTime = async (due_time: string) => {
    update({ due_time });
    const permission = await requestPermission();
    if (permission === 'denied') {
      Alert.alert(
        'Powiadomienia są zablokowane',
        'Godzina zostanie zapisana, ale przypomnienie nie przyjdzie, dopóki nie włączysz powiadomień w ustawieniach telefonu.',
        [
          { text: 'Później', style: 'cancel' },
          { text: 'Otwórz ustawienia', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  const save = async () => {
    if (!canSave) return;
    const input = { ...form, title: form.title.trim(), notes: form.notes.trim() };
    // Najpierw oczekujący autozapis checklisty — transakcje nie mogą się zagnieżdżać.
    await flushSubtasks();
    await db.withTransactionAsync(async () => {
      if (isNew) {
        const { lastInsertRowId } = await createTask(db, input);
        await replaceSubtasks(db, lastInsertRowId, subtaskInputs(subtasks));
        await setTaskTags(db, lastInsertRowId, tagIds);
      } else {
        await updateTask(db, taskId, input);
        await setTaskTags(db, taskId, tagIds);
      }
    });
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert('Usunąć zadanie?', form.title, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          await flushSubtasks();
          await deleteTask(db, taskId);
          router.back();
        },
      },
    ]);
  };

  const due = form.due_date;
  const customDue = due !== null && due !== today && due !== tomorrow;

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'Nowe zadanie' : 'Zadanie',
          headerRight: () => (
            <Pressable onPress={save} disabled={!canSave} hitSlop={8} accessibilityRole="button">
              <AppText variant="bodyStrong" tone={canSave ? 'accent' : 'textMuted'}>
                Zapisz
              </AppText>
            </Pressable>
          ),
        }}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {loaded ? (
          <>
            <TextField
              label="Tytuł"
              value={form.title}
              onChangeText={(title) => update({ title })}
              placeholder="Co jest do zrobienia?"
              autoFocus={isNew}
              returnKeyType="done"
            />

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Podzadania
                {subtasks.length ? ` · ${subtasks.filter((item) => item.done).length}/${subtasks.length}` : ''}
              </AppText>
              <SubtaskList items={subtasks} onChange={changeSubtasks} />
            </View>

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Termin
              </AppText>
              <View style={styles.chips}>
                <Chip label="Brak" selected={due === null} onPress={() => setDue(null)} />
                <Chip label="Dziś" selected={due === today} onPress={() => setDue(today)} />
                <Chip label="Jutro" selected={due === tomorrow} onPress={() => setDue(tomorrow)} />
                <Chip
                  label={customDue ? formatDayShort(due, today) : 'Inna data'}
                  icon="calendar_month"
                  selected={customDue}
                  onPress={() => setPickerOpen(true)}
                />
              </View>
            </View>

            {due ? (
              <View style={styles.section}>
                <AppText variant="label" tone="textSecondary">
                  Godzina i przypomnienie
                </AppText>
                <View style={styles.chips}>
                  <Chip label="Bez godziny" selected={form.due_time === null} onPress={() => update({ due_time: null })} />
                  <Chip
                    label={form.due_time ?? 'Ustaw godzinę'}
                    icon="notifications"
                    selected={form.due_time !== null}
                    onPress={() => setTimePickerOpen(true)}
                  />
                </View>
                {form.due_time ? (
                  <AppText variant="caption" tone="textMuted">
                    {notificationsSupported
                      ? 'O tej godzinie dostaniesz przypomnienie (chyba że zadanie będzie już zrobione).'
                      : 'W Expo Go powiadomienia nie działają — przypomnienie zacznie przychodzić po zainstalowaniu aplikacji (APK).'}
                  </AppText>
                ) : null}
              </View>
            ) : null}

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Powtarzanie
              </AppText>
              <View style={styles.chips}>
                <Chip label="Nie" selected={form.repeat === null} onPress={() => setRepeat(null)} />
                {REPEATS.map((repeat) => (
                  <Chip
                    key={repeat}
                    label={REPEAT_LABELS[repeat]}
                    icon="repeat"
                    selected={form.repeat === repeat}
                    onPress={() => setRepeat(repeat)}
                  />
                ))}
              </View>
              {form.repeat ? (
                <AppText variant="caption" tone="textMuted">
                  Po odhaczeniu zadanie przeskoczy na kolejny termin, a wykonanie trafi do „Zrobionych”.
                </AppText>
              ) : null}
            </View>

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Priorytet
              </AppText>
              <View style={styles.chips}>
                {PRIORITIES.map((priority) => (
                  <Chip
                    key={priority}
                    label={PRIORITY_LABELS[priority]}
                    icon={priority > 0 ? 'flag' : undefined}
                    iconColor={priorityColor(priority, colors)}
                    selected={form.priority === priority}
                    onPress={() => update({ priority })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Tagi
              </AppText>
              <TagPicker selected={tagIds} onChange={setTagIds} />
            </View>

            <TextField
              label="Notatki"
              value={form.notes}
              onChangeText={(notes) => update({ notes })}
              placeholder="Szczegóły (opcjonalnie)"
              multiline
            />

            {!isNew ? (
              <Button label="Usuń zadanie" variant="danger" icon="delete" onPress={confirmDelete} />
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <TimePickerSheet
        visible={timePickerOpen}
        title="Godzina"
        value={form.due_time}
        onChange={setTime}
        onClose={() => setTimePickerOpen(false)}
      />
      <DatePickerSheet
        visible={pickerOpen}
        title="Termin"
        today={today}
        value={due}
        onChange={setDue}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, padding: spacing.lg },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
