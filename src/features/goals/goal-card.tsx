import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Icon } from '@/components/icon';
import { goalFraction, goalProgressQuery, setGoalProgress, type Goal } from '@/db/goals';
import { useQuery } from '@/db/use-query';
import { Meter } from '@/features/stats/charts';
import { formatDayShort, type DateKey } from '@/lib/dates';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { GOAL_KINDS, goalPace, goalProgressText, goalStatus } from './goal-format';

const STATUS_TEXT = {
  done: '🏆 Cel osiągnięty',
  expired: 'Termin minął',
  upcoming: 'Jeszcze się nie zaczął',
  ahead: '✓ W planie',
  behind: 'Poniżej planu',
} as const;

type Props = { goal: Goal; today: DateKey; onPress: () => void; compact?: boolean };

/** Karta celu z postępem liczonym na żywo z danych (albo ręcznym dla celu „własnego”). */
export function GoalCard({ goal, today, onPress, compact = false }: Props) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const query = goalProgressQuery(goal);
  const { rows } = useQuery<{ value: number }>(query.sql, query.params, [
    'workouts',
    'habit_logs',
    'habits',
    'measurements',
    'goals',
  ]);
  const value = rows[0]?.value ?? (goal.kind === 'measurement' ? null : 0);
  const fraction = goalFraction(goal, value);
  const status = goalStatus(goal, fraction, today);
  const pace = value === null ? null : goalPace(goal, value, today);
  const statusColor =
    status === 'done' ? colors.success : status === 'behind' || status === 'expired' ? colors.warning : colors.textSecondary;
  const kind = GOAL_KINDS[goal.kind];

  return (
    <Pressable onPress={onPress} android_ripple={{ color: colors.border }} style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: withAlpha(colors.accent, 0.14) }]}>
          <Icon name={kind.icon} size={20} color={colors.accent} />
        </View>
        <View style={styles.titles}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {goal.title}
          </AppText>
          <AppText variant="caption" tone="textSecondary">
            {goalProgressText(goal, value)}
          </AppText>
        </View>
        <AppText variant="bodyStrong">{Math.round(fraction * 100)}%</AppText>
      </View>
      <Meter value={fraction} color={status === 'done' ? colors.success : colors.accent} />
      {!compact ? (
        <View style={styles.footer}>
          <AppText variant="caption" style={[styles.flex, { color: statusColor }]}>
            {STATUS_TEXT[status]}
            {pace ? ` · ${pace}` : ''}
          </AppText>
          <AppText variant="caption" tone="textMuted">
            do {formatDayShort(goal.end_date, today)}
          </AppText>
        </View>
      ) : null}
      {!compact && goal.kind === 'manual' ? (
        <View style={styles.manual}>
          <IconButton
            icon="remove"
            accessibilityLabel="Odejmij 1"
            onPress={() => setGoalProgress(db, goal.id, goal.progress - 1)}
          />
          <AppText variant="caption" tone="textSecondary">
            Postęp
          </AppText>
          <IconButton
            icon="add"
            variant="filled"
            accessibilityLabel="Dodaj 1"
            onPress={() => setGoalProgress(db, goal.id, goal.progress + 1)}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.md, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  manual: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
});
