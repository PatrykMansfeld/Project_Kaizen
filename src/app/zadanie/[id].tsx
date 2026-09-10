import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DatePickerSheet } from '@/components/date-picker-sheet';
import { TextField } from '@/components/text-field';
import {
  PRIORITY_LABELS,
  createTask,
  deleteTask,
  getTask,
  updateTask,
  type Priority,
  type TaskInput,
} from '@/db/tasks';
import { priorityColor } from '@/features/tasks/priority';
import { addDays, formatDayShort, isDateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const PRIORITIES: Priority[] = [0, 1, 2, 3];

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
  });
  const [loaded, setLoaded] = useState(isNew);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getTask(db, taskId).then((task) => {
      if (!task) {
        router.back();
        return;
      }
      setForm({ title: task.title, notes: task.notes, priority: task.priority, due_date: task.due_date });
      setLoaded(true);
    });
  }, [db, isNew, taskId]);

  const update = (patch: Partial<TaskInput>) => setForm((current) => ({ ...current, ...patch }));
  const canSave = loaded && form.title.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    const input = { ...form, title: form.title.trim(), notes: form.notes.trim() };
    if (isNew) {
      await createTask(db, input);
    } else {
      await updateTask(db, taskId, input);
    }
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert('Usunąć zadanie?', form.title, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
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
                Termin
              </AppText>
              <View style={styles.chips}>
                <Chip label="Brak" selected={due === null} onPress={() => update({ due_date: null })} />
                <Chip label="Dziś" selected={due === today} onPress={() => update({ due_date: today })} />
                <Chip label="Jutro" selected={due === tomorrow} onPress={() => update({ due_date: tomorrow })} />
                <Chip
                  label={customDue ? formatDayShort(due, today) : 'Inna data'}
                  icon="calendar_month"
                  selected={customDue}
                  onPress={() => setPickerOpen(true)}
                />
              </View>
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

      <DatePickerSheet
        visible={pickerOpen}
        title="Termin"
        today={today}
        value={due}
        onChange={(due_date) => update({ due_date })}
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
