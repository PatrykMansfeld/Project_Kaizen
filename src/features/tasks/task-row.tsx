import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { CheckCircle } from '@/components/check-circle';
import { Icon } from '@/components/icon';
import { PRIORITY_LABELS, type Task } from '@/db/tasks';
import { formatDayShort, relativeDayLabel, toDateKey, type DateKey } from '@/lib/dates';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { priorityColor } from './priority';

type Props = {
  task: Task;
  today: DateKey;
  onPress: () => void;
  onToggle: () => void;
};

function dayLabel(day: DateKey, today: DateKey) {
  return relativeDayLabel(day, today) ?? formatDayShort(day, today);
}

export function TaskRow({ task, today, onPress, onToggle }: Props) {
  const { colors } = useTheme();
  const done = task.completed_at !== null;
  const overdue = !done && task.due_date !== null && task.due_date < today;

  let dateText: string | null = null;
  if (done) {
    dateText = `Zrobione: ${dayLabel(toDateKey(new Date(task.completed_at!)), today).toLowerCase()}`;
  } else if (task.due_date) {
    dateText = overdue ? `Zaległe · ${dayLabel(task.due_date, today)}` : dayLabel(task.due_date, today);
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
        {dateText || task.priority > 0 ? (
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
          </View>
        ) : null}
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
