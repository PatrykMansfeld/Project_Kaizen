import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button, IconButton } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TASK_LIST_SQL, TASK_TABLES, setTaskDue, setTaskPriority, type Task } from '@/db/tasks';
import { useQuery } from '@/db/use-query';
import { useTags } from '@/features/tags/tags';
import { QUADRANTS, QUADRANT_KEYS, moveToQuadrant, quadrantOf, splitByQuadrant, type Quadrant } from '@/features/tasks/matrix';
import { TaskRow } from '@/features/tasks/task-row';
import { type DateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Macierz Eisenhowera: otwarte zadania w czterech ćwiartkach (pilne × ważne), z przenoszeniem między nimi. */
export default function MatrixScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const { byId: tagsById } = useTags();
  const [only, setOnly] = useState<Quadrant | null>(null);
  const [moving, setMoving] = useState<Task | null>(null);
  const { rows: tasks, loaded } = useQuery<Task>(TASK_LIST_SQL.open, { $today: today, $tag: null }, TASK_TABLES);
  const quadrants = splitByQuadrant(tasks, today);
  const visible = only ? [only] : QUADRANT_KEYS;

  return (
    <ScrollScreen
      title="Macierz Eisenhowera"
      gap={spacing.lg}
      headerRight={<IconButton icon="add" accessibilityLabel="Nowe zadanie" onPress={() => router.push('/zadanie/nowe')} />}>
      <AppText variant="caption" tone="textSecondary">
        Ważne — priorytet średni lub wysoki. Pilne — termin najpóźniej pojutrze albo zaległy. Stuknij zadanie, żeby je
        przenieść.
      </AppText>

      <View style={styles.grid}>
        {QUADRANT_KEYS.map((key) => {
          const info = QUADRANTS[key];
          const color = colors[info.color];
          const selected = only === key;
          return (
            <Pressable
              key={key}
              onPress={() => setOnly(selected ? null : key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${info.title}: ${quadrants[key].length}`}
              style={[
                styles.tile,
                { backgroundColor: withAlpha(color, selected ? 0.24 : 0.12), borderColor: selected ? color : 'transparent' },
              ]}>
              <View style={styles.tileHeader}>
                <Icon name={info.icon} size={18} color={color} />
                <AppText variant="heading">{quadrants[key].length}</AppText>
              </View>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {info.title}
              </AppText>
              <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
                {info.action}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {loaded && tasks.length === 0 ? (
        <EmptyState icon="grid_view" color={colors.tasks} title="Brak otwartych zadań" description="Dodaj zadanie, a trafi do właściwej ćwiartki." />
      ) : null}

      {tasks.length > 0
        ? visible.map((key) => (
            <Section
              key={key}
              title={QUADRANTS[key].title}
              icon={QUADRANTS[key].icon}
              color={colors[QUADRANTS[key].color]}
              meta={String(quadrants[key].length)}>
              <AppText variant="caption" tone="textMuted">
                {QUADRANTS[key].hint}
              </AppText>
              {quadrants[key].map((task) => (
                <TaskRow key={task.id} task={task} today={today} tagsById={tagsById} onPress={() => setMoving(task)} />
              ))}
            </Section>
          ))
        : null}

      <BottomSheet visible={moving !== null} onClose={() => setMoving(null)}>
        {moving ? <MoveContent task={moving} today={today} onClose={() => setMoving(null)} /> : null}
      </BottomSheet>
    </ScrollScreen>
  );
}

/** Przeniesienie do innej ćwiartki (z opisem, co się zmieni) albo otwarcie zadania. */
function MoveContent({ task, today, onClose }: { task: Task; today: DateKey; onClose: () => void }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const current = quadrantOf(task, today);

  const move = async (quadrant: Quadrant) => {
    const target = moveToQuadrant(task, quadrant, today);
    if (target.priority !== task.priority) await setTaskPriority(db, task.id, target.priority);
    if (target.due_date !== task.due_date) await setTaskDue(db, task.id, target.due_date);
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
        <AppText tone="textSecondary">Teraz: {QUADRANTS[current].title.toLowerCase()}. Przenieś do:</AppText>
      </View>
      {QUADRANT_KEYS.filter((key) => key !== current).map((key) => {
        const info = QUADRANTS[key];
        const { changes } = moveToQuadrant(task, key, today);
        return (
          <Pressable
            key={key}
            onPress={() => void move(key)}
            accessibilityRole="button"
            android_ripple={{ color: colors.border }}
            style={[styles.option, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name={info.icon} size={20} color={colors[info.color]} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{info.title}</AppText>
              <AppText variant="caption" tone="textSecondary">
                {changes.join(', ')}
              </AppText>
            </View>
          </Pressable>
        );
      })}
      <Button label="Otwórz zadanie" icon="open_in_new" variant="secondary" onPress={openTask} />
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '48%', flexGrow: 1, gap: 2, padding: spacing.md, borderRadius: radius.md, borderWidth: 2 },
  tileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { gap: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
  flex: { flex: 1, gap: 2 },
});
