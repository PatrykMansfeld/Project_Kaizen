import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { CheckCircle } from '@/components/check-circle';
import { Icon } from '@/components/icon';
import { parseTagIds, type Tag } from '@/db/tags';
import { PRIORITY_LABELS, REPEAT_LABELS, type Task } from '@/db/tasks';
import { TagBadges } from '@/features/tags/tags';
import { formatDayShort, relativeDayLabel, toDateKey, type DateKey } from '@/lib/dates';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { priorityColor } from './priority';

type Props = {
  task: Task;
  today: DateKey;
  onPress: () => void;
  onToggle: () => void;
  /** Wszystkie tagi (z useTags w ekranie) — jedno zapytanie na listę, nie na wiersz. */
  tagsById?: Map<number, Tag>;
};

function dayLabel(day: DateKey, today: DateKey) {
  return relativeDayLabel(day, today) ?? formatDayShort(day, today);
}

export function TaskRow({ task, today, onPress, onToggle, tagsById }: Props) {
  const { colors } = useTheme();
  const done = task.completed_at !== null;
  const overdue = !done && task.due_date !== null && task.due_date < today;
  const subtaskCount = task.subtask_count ?? 0;
  const tagIds = parseTagIds(task.tag_ids);

  let dateText: string | null = null;
  if (done) {
    dateText = `Zrobione: ${dayLabel(toDateKey(new Date(task.completed_at!)), today).toLowerCase()}`;
  } else if (task.due_date) {
    const when = dayLabel(task.due_date, today) + (task.due_time ? `, ${task.due_time}` : '');
    dateText = overdue ? `Zaległe · ${when}` : when;
  }
  const dateColor = overdue ? colors.danger : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={[styles.row, { backgroundColor: colors.surface }]}>
      <CheckCircle
        checked={done}
        onPress={onToggle}
        color={colors.tasks}
        accessibilityLabel={done ? 'Oznacz jako niezrobione' : 'Oznacz jako zrobione'}
      />
      <View style={styles.body}>
        <AppText
          numberOfLines={2}
          style={done && { color: colors.textMuted, textDecorationLine: 'line-through' }}>
          {task.title}
        </AppText>
        {dateText || task.priority > 0 || task.repeat || subtaskCount > 0 ? (
          <View style={styles.meta}>
            {dateText ? (
              <View style={styles.metaItem}>
                <Icon name={done ? 'done' : 'event'} size={14} color={dateColor} />
                <AppText variant="caption" style={{ color: dateColor }}>
                  {dateText}
                </AppText>
              </View>
            ) : null}
            {task.priority > 0 && !done ? (
              <View style={styles.metaItem}>
                <Icon name="flag" size={14} color={priorityColor(task.priority, colors)} />
                <AppText variant="caption" tone="textSecondary">
                  {PRIORITY_LABELS[task.priority]}
                </AppText>
              </View>
            ) : null}
            {task.repeat && !done ? (
              <View style={styles.metaItem}>
                <Icon name="repeat" size={14} color={colors.textSecondary} />
                <AppText variant="caption" tone="textSecondary">
                  {REPEAT_LABELS[task.repeat]}
                </AppText>
              </View>
            ) : null}
            {subtaskCount > 0 ? (
              <View style={styles.metaItem}>
                <Icon name="checklist" size={14} color={colors.textSecondary} />
                <AppText variant="caption" tone="textSecondary">
                  {task.subtask_done ?? 0}/{subtaskCount}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
        {tagsById && tagIds.length > 0 ? <TagBadges tagIds={tagIds} byId={tagsById} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  body: { flex: 1, gap: spacing.xs },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
