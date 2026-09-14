import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Section } from '@/components/section';
import { useQuery } from '@/db/use-query';
import { StatRow, StatTile } from '@/features/stats/charts';
import { WEEKDAYS_SHORT, fromDateKey, toDateKey, weekdayIndex } from '@/lib/dates';
import { plural } from '@/lib/format';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { versus, type SectionProps } from './shared';

export function TasksSection({ range, period, today }: SectionProps) {
  const { colors } = useTheme();
  // completed_at to czas UTC — pobieramy z zapasem i dzielimy na dni lokalnie.
  const { rows: completed } = useQuery<{ id: number; title: string; completed_at: string }>(
    'SELECT id, title, completed_at FROM tasks WHERE completed_at >= $since ORDER BY completed_at DESC',
    { $since: fromDateKey(range.prevFrom).toISOString() },
    ['tasks'],
  );
  const { rows: overdueRows } = useQuery<{ n: number }>(
    'SELECT COUNT(*) AS n FROM tasks WHERE completed_at IS NULL AND due_date < $today',
    { $today: today },
    ['tasks'],
  );

  const doneDay = (task: { completed_at: string }) => toDateKey(new Date(task.completed_at));
  const inRange = completed.filter((task) => doneDay(task) >= range.from && doneDay(task) <= range.to);
  const inPrevious = completed.filter((task) => doneDay(task) >= range.prevFrom && doneDay(task) <= range.prevTo);
  const isCurrent = range.from <= today && today <= range.to;

  return (
    <Section icon="checklist" color={colors.tasks} title="Zadania">
      <StatRow>
        <StatTile
          label="Zrobione"
          value={String(inRange.length)}
          detail={versus(inRange.length - inPrevious.length, period, String)}
        />
        {isCurrent ? (
          <StatTile label="Zaległe teraz" value={String(overdueRows[0]?.n ?? 0)} detail="otwarte po terminie" />
        ) : null}
      </StatRow>
      {period === 'week' && inRange.length > 0 ? (
        <Card>
          {inRange.slice(0, 5).map((task) => (
            <View key={task.id} style={styles.doneRow}>
              <Icon name="check" size={16} color={colors.tasks} />
              <AppText style={styles.flex} numberOfLines={1}>
                {task.title}
              </AppText>
              <AppText variant="caption" tone="textMuted">
                {WEEKDAYS_SHORT[weekdayIndex(doneDay(task))]}
              </AppText>
            </View>
          ))}
          {inRange.length > 5 ? (
            <AppText variant="caption" tone="textMuted">
              i {plural(inRange.length - 5, ['inne', 'inne', 'innych'])}
            </AppText>
          ) : null}
        </Card>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
