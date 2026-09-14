import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { DateChoice } from '@/components/date-choice';
import { HeaderTextButton } from '@/components/header';
import { PromptSheet } from '@/components/prompt-sheet';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import { PROJECTS_SQL, createProject, type Project } from '@/db/projects';
import { getSubtasks, replaceSubtasks } from '@/db/subtasks';
import { getTaskTagIds, setTaskTags } from '@/db/tags';
import {
  PRIORITY_LABELS,
  REPEAT_LABELS,
  createTask,
  deleteTask,
  getTask,
  updateTask,
  type Priority,
  type Repeat,
  type TaskInput,
} from '@/db/tasks';
import { useQuery } from '@/db/use-query';
import { requestPermissionOrWarn } from '@/features/reminders/permission';
import { EXPO_GO_NOTICE, notificationsSupported } from '@/features/reminders/reminders';
import { TagPicker } from '@/features/tags/tags';
import { priorityColor } from '@/features/tasks/priority';
import { SubtaskList, newSubtaskKey, type SubtaskDraft } from '@/features/tasks/subtask-list';
import { confirmDelete } from '@/lib/alerts';
import { addDays, isDateKey, type DateKey } from '@/lib/dates';
import { parseWholeNumber } from '@/lib/format';
import { useAutosave } from '@/lib/use-autosave';
import { useEditRecord } from '@/lib/use-edit-record';
import { useToday } from '@/lib/use-today';
import { useTheme } from '@/theme/use-theme';

const PRIORITIES: Priority[] = [0, 1, 2, 3];
const REPEATS: Repeat[] = ['daily', 'weekdays', 'weekly', 'monthly'];

/** Kroki z formularza → do bazy (puste pomijamy). */
function subtaskInputs(items: SubtaskDraft[]) {
  return items.filter((item) => item.title.trim()).map((item) => ({ title: item.title.trim(), done: item.done }));
}

/** Nowe zadanie: /zadanie/nowe (opcjonalnie ?due=2026-09-10&project=2), edycja: /zadanie/123. */
export default function TaskEditScreen() {
  const { id, due: initialDue, project: initialProject } = useLocalSearchParams<{
    id: string;
    due?: string;
    project?: string;
  }>();
  const isNew = id === 'nowe';
  const taskId = Number(id);

  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();

  const [form, setForm] = useState<TaskInput>({
    title: '',
    notes: '',
    priority: 0,
    due_date: isDateKey(initialDue) ? initialDue : null,
    due_time: null,
    repeat: null,
    project_id: parseWholeNumber(initialProject),
  });
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [projectNameOpen, setProjectNameOpen] = useState(false);
  const { rows: projects } = useQuery<Project>(PROJECTS_SQL, [], ['projects', 'tasks']);

  const loaded = useEditRecord(
    isNew ? null : taskId,
    async () => {
      const [task, subtaskRows, taskTagIds] = await Promise.all([
        getTask(db, taskId),
        getSubtasks(db, taskId),
        getTaskTagIds(db, taskId),
      ]);
      return task && { task, subtaskRows, taskTagIds };
    },
    ({ task, subtaskRows, taskTagIds }) => {
      setForm({
        title: task.title,
        notes: task.notes,
        priority: task.priority,
        due_date: task.due_date,
        due_time: task.due_time,
        repeat: task.repeat,
        project_id: task.project_id,
      });
      setSubtasks(subtaskRows.map((row) => ({ key: newSubtaskKey(), title: row.title, done: row.done === 1 })));
      setTagIds(taskTagIds);
    },
  );

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

  const setTime = (due_time: string) => {
    update({ due_time });
    void requestPermissionOrWarn(
      'Godzina zostanie zapisana, ale przypomnienie nie przyjdzie, dopóki nie włączysz powiadomień w ustawieniach telefonu.',
    );
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

  const remove = () =>
    confirmDelete('Usunąć zadanie?', form.title, async () => {
      await flushSubtasks();
      await deleteTask(db, taskId);
      router.back();
    });

  const due = form.due_date;
  const subtasksDone = subtasks.filter((item) => item.done).length;

  return (
    <>
      <ScrollScreen
        title={isNew ? 'Nowe zadanie' : 'Zadanie'}
        headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
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

            <Section title={subtasks.length ? `Podzadania · ${subtasksDone}/${subtasks.length}` : 'Podzadania'}>
              <SubtaskList items={subtasks} onChange={changeSubtasks} />
            </Section>

            <Section title="Termin">
              <DateChoice
                value={due}
                onChange={setDue}
                today={today}
                pickerTitle="Termin"
                presets={[
                  { label: 'Brak', date: null },
                  { label: 'Dziś', date: today },
                  { label: 'Jutro', date: addDays(today, 1) },
                ]}
              />
            </Section>

            {due ? (
              <Section title="Godzina i przypomnienie">
                <ChipRow>
                  <Chip label="Bez godziny" selected={form.due_time === null} onPress={() => update({ due_time: null })} />
                  <Chip
                    label={form.due_time ?? 'Ustaw godzinę'}
                    icon="notifications"
                    selected={form.due_time !== null}
                    onPress={() => setTimePickerOpen(true)}
                  />
                </ChipRow>
                {form.due_time ? (
                  <AppText variant="caption" tone="textMuted">
                    {notificationsSupported
                      ? 'O tej godzinie dostaniesz przypomnienie (chyba że zadanie będzie już zrobione).'
                      : EXPO_GO_NOTICE}
                  </AppText>
                ) : null}
              </Section>
            ) : null}

            <Section title="Powtarzanie">
              <ChipRow>
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
              </ChipRow>
              {form.repeat ? (
                <AppText variant="caption" tone="textMuted">
                  Po odhaczeniu zadanie przeskoczy na kolejny termin, a wykonanie trafi do „Zrobionych”.
                </AppText>
              ) : null}
            </Section>

            <Section title="Priorytet">
              <ChipRow>
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
              </ChipRow>
            </Section>

            <Section title="Projekt">
              <ChipRow>
                <Chip label="Brak" selected={form.project_id === null} onPress={() => update({ project_id: null })} />
                {projects.map((project) => (
                  <Chip
                    key={project.id}
                    label={project.name}
                    icon="folder"
                    selected={form.project_id === project.id}
                    onPress={() => update({ project_id: project.id })}
                  />
                ))}
                <Chip label="Nowy projekt" icon="create_new_folder" selected={false} onPress={() => setProjectNameOpen(true)} />
              </ChipRow>
            </Section>

            <Section title="Tagi">
              <TagPicker selected={tagIds} onChange={setTagIds} />
            </Section>

            <TextField
              label="Notatki"
              value={form.notes}
              onChangeText={(notes) => update({ notes })}
              placeholder="Szczegóły (opcjonalnie)"
              multiline
            />

            {!isNew ? <Button label="Usuń zadanie" variant="danger" icon="delete" onPress={remove} /> : null}
          </>
        ) : null}
      </ScrollScreen>

      <PromptSheet
        visible={projectNameOpen}
        title="Nowy projekt"
        placeholder="np. Remont, Praca, Wakacje"
        submitLabel="Utwórz"
        onSubmit={async (name) => update({ project_id: await createProject(db, name) })}
        onClose={() => setProjectNameOpen(false)}
      />
      <TimePickerSheet
        visible={timePickerOpen}
        title="Godzina"
        value={form.due_time}
        onChange={setTime}
        onClose={() => setTimePickerOpen(false)}
      />
    </>
  );
}
