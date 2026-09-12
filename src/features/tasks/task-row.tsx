import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { CheckCircle } from '@/components/check-circle';
import { Icon, type IconName } from '@/components/icon';
import { parseTagIds, type Tag } from '@/db/tags';
import { PRIORITY_LABELS, REPEAT_LABELS, toggleTask, type Task } from '@/db/tasks';
import { TagBadges } from '@/features/tags/tags';
import { formatDayRelative, toDateKey, type DateKey } from '@/lib/dates';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { priorityColor } from './priority';

type Props = {
  task: Task;
  today: DateKey;
  /** Domyślnie: otwarcie edycji zadania. */
  onPress?: () => void;
  /** Domyślnie: odhaczenie / odznaczenie (z obsługą zadań cyklicznych). */
  onToggle?: () => void;
  /** Wszystkie tagi (z useTags w ekranie) — jedno zapytanie na listę, nie na wiersz. */
  tagsById?: Map<number, Tag>;
};

export function TaskRow({ task, today, onPress, onToggle, tagsById }: Props) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const open = onPress ?? (() => router.push({ pathname: '/zadanie/[id]', params: { id: String(task.id) } }));
  const toggle = onToggle ?? (() => void toggleTask(db, task, today));
  const done = task.completed_at !== null;
  const overdue = !done && task.due_date !== null && task.due_date < today;
  const subtaskCount = task.subtask_count ?? 0;
  const tagIds = parseTagIds(task.tag_ids);

  let dateText: string | null = null;
  if (done) {
    dateText = `Zrobione: ${formatDayRelative(toDateKey(new Date(task.completed_at!)), today).toLowerCase()}`;
  } else if (task.due_date) {
    const when = formatDayRelative(task.due_date, today) + (task.due_time ? `, ${task.due_time}` : '');
    dateText = overdue ? `Zaległe · ${when}` : when;
  }

  const meta: ReactNode[] = [];
  if (dateText) {
    const dateColor = overdue ? colors.danger : colors.textSecondary;
    meta.push(<MetaItem key="date" icon={done ? 'done' : 'event'} iconColor={dateColor} text={dateText} textColor={dateColor} />);
  }
  if (task.priority > 0 && !done) {
    meta.push(
      <MetaItem key="priority" icon="flag" iconColor={priorityColor(task.priority, colors)} text={PRIORITY_LABELS[task.priority]} />,
    );
  }
  if (task.repeat && !done) meta.push(<MetaItem key="repeat" icon="repeat" text={REPEAT_LABELS[task.repeat]} />);
  if (task.project_name) meta.push(<MetaItem key="project" icon="folder" text={task.project_name} />);
  if (subtaskCount > 0) meta.push(<MetaItem key="subtasks" icon="checklist" text={`${task.subtask_done ?? 0}/${subtaskCount}`} />);

  return (
    <Card variant="row" onPress={open}>
      <CheckCircle
        checked={done}
        onPress={toggle}
        color={colors.tasks}
        accessibilityLabel={done ? 'Oznacz jako niezrobione' : 'Oznacz jako zrobione'}
      />
      <View style={styles.body}>
        <AppText numberOfLines={2} style={done && { color: colors.textMuted, textDecorationLine: 'line-through' }}>
          {task.title}
        </AppText>
        {meta.length > 0 ? <View style={styles.meta}>{meta}</View> : null}
        {tagsById && tagIds.length > 0 ? <TagBadges tagIds={tagIds} byId={tagsById} /> : null}
      </View>
    </Card>
  );
}

function MetaItem({ icon, text, iconColor, textColor }: { icon: IconName; text: string; iconColor?: string; textColor?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metaItem}>
      <Icon name={icon} size={14} color={iconColor ?? colors.textSecondary} />
      <AppText variant="caption" numberOfLines={1} style={{ color: textColor ?? colors.textSecondary }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: spacing.xs },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
