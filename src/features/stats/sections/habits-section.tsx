import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyLine } from '@/components/empty-state';
import { Section } from '@/components/section';
import { HABITS_SQL, HABIT_DONE_DAYS_SQL, HABIT_LOGS_RANGE_SQL, countsByHabit, doneDaysByHabit, type Habit, type HabitDoneDay, type HabitLog } from '@/db/habits';
import { useQuery } from '@/db/use-query';
import { HabitIcon } from '@/features/habits/habit-card';
import { formatStreak, formatWeeklyStreak } from '@/features/habits/streak';
import { Meter, StatRow, StatTile } from '@/features/stats/charts';
import { habitsSummary } from '@/features/stats/compute';
import { FORMS, plural } from '@/lib/format';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { versus, type SectionProps } from './shared';

export function HabitsSection({ range, period, today }: SectionProps) {
  const { colors, dark } = useTheme();
  const { rows: habits } = useQuery<Habit>(HABITS_SQL, [], ['habits']);
  // Od początku poprzedniego okresu — do porównania skuteczności.
  const { rows: logs } = useQuery<HabitLog>(
    HABIT_LOGS_RANGE_SQL,
    { $from: range.prevFrom, $to: range.to },
    ['habit_logs'],
  );
  const { rows: doneRows } = useQuery<HabitDoneDay>(HABIT_DONE_DAYS_SQL, [], ['habits', 'habit_logs']);

  const counts = countsByHabit(logs);
  const doneDays = doneDaysByHabit(doneRows);
  const current = habitsSummary(habits, counts, doneDays, range.from, range.to, today);
  const previous = habitsSummary(habits, counts, doneDays, range.prevFrom, range.prevTo, today);
  const stats = current.stats;
  const diff = current.rate !== null && previous.rate !== null ? Math.round((current.rate - previous.rate) * 100) : null;
  const top = stats.reduce<(typeof stats)[number] | null>((best, stat) => (!best || stat.best > best.best ? stat : best), null);

  return (
    <Section icon="check_circle" color={colors.habits} title="Nawyki">
      {habits.length === 0 ? (
        <EmptyLine text="Brak nawyków do podsumowania." />
      ) : (
        <>
          <StatRow>
            <StatTile
              label="Skuteczność"
              value={current.rate === null ? '—' : `${Math.round(current.rate * 100)}%`}
              detail={versus(diff, period, (value) => `${value} p.p.`) ?? `${current.done} z ${current.scheduled} zaplanowanych`}
            />
            <StatTile
              label="Najlepsza seria"
              value={top && top.best > 0 ? (top.unit === 'weeks' ? formatWeeklyStreak(top.best) : formatStreak(top.best)) : '—'}
              detail={top && top.best > 0 ? `${top.habit.icon} ${top.habit.name}` : undefined}
            />
          </StatRow>
          <Card>
            {stats.map(({ habit, rate: habitRate, done, scheduled, best, unit }) => {
              const color = paletteColor(habit.color, dark);
              return (
                <View key={habit.id} style={styles.habitRow}>
                  <View style={styles.habitHeader}>
                    <HabitIcon icon={habit.icon} color={color} size={28} />
                    <AppText style={styles.flex} numberOfLines={1}>
                      {habit.name}
                    </AppText>
                    <AppText variant="bodyStrong">{habitRate === null ? '—' : `${Math.round(habitRate * 100)}%`}</AppText>
                  </View>
                  <Meter value={habitRate ?? 0} color={color} />
                  <AppText variant="caption" tone="textMuted">
                    {scheduled
                      ? `${done} z ${unit === 'weeks' ? plural(scheduled, ['tygodnia', 'tygodni', 'tygodni']) : `${scheduled} dni`}`
                      : unit === 'weeks'
                        ? 'Pierwszy tydzień jeszcze trwa'
                        : 'Brak dni do zrobienia'}
                    {best > 0
                      ? ` · najlepsza seria ${unit === 'weeks' ? `${best} tyg.` : plural(best, FORMS.day)}`
                      : ''}
                  </AppText>
                </View>
              );
            })}
          </Card>
        </>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  habitRow: { gap: spacing.xs },
  habitHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
