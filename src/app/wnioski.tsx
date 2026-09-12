import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { ScrollScreen } from '@/components/screen';
import { HABITS_SQL, HABIT_DONE_DAYS_SQL, doneDaysByHabit, type Habit, type HabitDoneDay } from '@/db/habits';
import { MOODS_RANGE_SQL, type MoodRow } from '@/db/journal';
import { SLEEP_RANGE_SQL, type SleepLog } from '@/db/sleep';
import { useQuery } from '@/db/use-query';
import { computeInsights, type Insight, type InsightModule } from '@/features/insights/insights';
import { BarList, ColumnChart } from '@/features/stats/charts';
import { WEEKDAYS, WEEKDAYS_SHORT, addDays, fromDateKey, toDateKey, type DateKey } from '@/lib/dates';
import { capitalize } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { spacing, type ThemeColors } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const RANGES = [
  { days: 30, label: '30 dni' },
  { days: 90, label: '90 dni' },
  { days: 365, label: 'Rok' },
] as const;

function moduleColor(colors: ThemeColors, module: InsightModule) {
  return module === 'sleep' ? colors.accent : colors[module];
}

/** Wnioski: zależności między nastrojem, snem, treningami, nawykami i zadaniami. */
export default function InsightsScreen() {
  const today = useToday();
  const [rangeDays, setRangeDays] = useState<number>(90);
  const from = addDays(today, -(rangeDays - 1));
  const params = { $from: from, $to: today };

  const { rows: moodRows } = useQuery<MoodRow>(MOODS_RANGE_SQL, params, ['journal_entries']);
  const { rows: workouts } = useQuery<{ date: DateKey; duration_min: number | null }>(
    'SELECT date, duration_min FROM workouts WHERE date BETWEEN $from AND $to',
    params,
    ['workouts'],
  );
  const { rows: sleep } = useQuery<SleepLog>(SLEEP_RANGE_SQL, params, ['sleep_logs']);
  const { rows: habits } = useQuery<Habit>(HABITS_SQL, [], ['habits']);
  const { rows: doneRows } = useQuery<HabitDoneDay>(HABIT_DONE_DAYS_SQL, [], ['habits', 'habit_logs']);
  const { rows: taskRows } = useQuery<{ completed_at: string }>(
    'SELECT completed_at FROM tasks WHERE completed_at >= $fromIso',
    { $fromIso: fromDateKey(from).toISOString() },
    ['tasks'],
  );

  const days: DateKey[] = [];
  for (let day = from; day <= today; day = addDays(day, 1)) days.push(day);

  const insights = computeInsights({
    days,
    today,
    moods: new Map(moodRows.map((row) => [row.date, row.mood])),
    workouts,
    sleep,
    habits,
    doneDays: doneDaysByHabit(doneRows),
    tasksDone: taskRows.map((row) => toDateKey(new Date(row.completed_at))).filter((day) => day >= from && day <= today),
  });

  return (
    <ScrollScreen title="Wnioski" gap={spacing.lg}>
      <View style={styles.chips}>
        {RANGES.map((range) => (
          <Chip
            key={range.days}
            label={range.label}
            selected={rangeDays === range.days}
            onPress={() => setRangeDays(range.days)}
          />
        ))}
      </View>
      {insights.length === 0 ? (
        <EmptyState
          icon="lightbulb"
          title="Za mało danych"
          description="Wnioski pojawią się, gdy przez kilka tygodni będziesz oceniać nastrój w dzienniku, zapisywać sen, treningi i odhaczać nawyki."
        />
      ) : (
        <>
          {insights.map((insight) => (
            <InsightCard key={insight.key} insight={insight} />
          ))}
          <AppText variant="caption" tone="textMuted">
            To zależności z Twoich danych, nie dowód przyczyny — traktuj je jako podpowiedź, co warto sprawdzić.
          </AppText>
        </>
      )}
    </ScrollScreen>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const { colors } = useTheme();
  const color = moduleColor(colors, insight.module);
  const [selected, setSelected] = useState<number | null>(null);
  const weekdays = insight.weekdays;
  const shown = selected ?? weekdays?.highlight ?? null;

  return (
    <Card>
      <View style={styles.header}>
        <Icon name={insight.icon} size={22} color={color} />
        <AppText variant="bodyStrong" style={styles.flex}>
          {insight.title}
        </AppText>
      </View>
      <AppText tone="textSecondary">{insight.detail}</AppText>
      {insight.compare ? <BarList items={insight.compare.items} max={insight.compare.max} color={color} /> : null}
      {weekdays ? (
        <View style={styles.chart}>
          <AppText variant="caption" tone="textSecondary">
            {shown !== null
              ? `${capitalize(WEEKDAYS[shown])}: ${
                  weekdays.values[shown] === null ? 'za mało danych' : weekdays.format(weekdays.values[shown]!)
                }`
              : ' '}
          </AppText>
          <ColumnChart
            columns={weekdays.values.map((value, index) => ({
              key: String(index),
              value: value ?? 0,
              axisLabel: WEEKDAYS_SHORT[index],
              accessibilityLabel: `${WEEKDAYS[index]}: ${value === null ? 'za mało danych' : weekdays.format(value)}`,
            }))}
            max={weekdays.max || 1}
            color={color}
            height={72}
            selectedKey={shown === null ? null : String(shown)}
            onSelect={(key) => setSelected(Number(key) === selected ? null : Number(key))}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1 },
  chart: { gap: spacing.xs },
});
