import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Chip, ChipRow } from '@/components/chip';
import { PeriodNavigator } from '@/components/period-navigator';
import { ScrollScreen } from '@/components/screen';
import { HABITS_SQL, type Habit } from '@/db/habits';
import { MOODS_RANGE_SQL, type MoodRow } from '@/db/journal';
import { SLEEP_RANGE_SQL, type SleepLog } from '@/db/sleep';
import { useQuery } from '@/db/use-query';
import {
  MONTHS_SHORT,
  legendLabels,
  metricLevels,
  pixelLevel,
  pixelReadout,
  yearDay,
  type PixelData,
  type PixelMetric,
} from '@/features/insights/year-pixels';
import { formatDayLong, type DateKey } from '@/lib/dates';
import { formatDecimal, formatDuration, plural } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
const MONTH_INDEXES = Array.from({ length: 12 }, (_, index) => index);
const CELL_HEIGHT = 14;
const DAY_LABEL_WIDTH = 18;

/** Krycie koloru dla poziomu 1…n: od jasnego do pełnego (skala sekwencyjna jednego koloru). */
function levelAlpha(level: number, levels: number) {
  return 0.25 + (0.75 * (level - 1)) / (levels - 1);
}

/** Rok w pikselach: każdy dzień roku jako kratka pokolorowana nastrojem, snem, treningiem albo nawykiem. */
export default function YearScreen() {
  const today = useToday();
  const { colors, dark } = useTheme();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [metric, setMetric] = useState<PixelMetric>('mood');
  const [selectedDay, setSelectedDay] = useState<DateKey | null>(null);
  const range = { $from: `${year}-01-01`, $to: `${year}-12-31` };

  const { rows: habits } = useQuery<Habit>(HABITS_SQL, [], ['habits']);
  const habitId = metric.startsWith('habit:') ? Number(metric.slice(6)) : -1;
  const habit = habits.find((item) => item.id === habitId) ?? null;

  const { rows: moodRows } = useQuery<MoodRow>(MOODS_RANGE_SQL, range, ['journal_entries']);
  const { rows: sleepRows } = useQuery<SleepLog>(SLEEP_RANGE_SQL, range, ['sleep_logs']);
  const { rows: workoutRows } = useQuery<{ date: DateKey; count: number; minutes: number }>(
    `SELECT date, COUNT(*) AS count, COALESCE(SUM(duration_min), 0) AS minutes
     FROM workouts WHERE date BETWEEN $from AND $to GROUP BY date`,
    range,
    ['workouts'],
  );
  const { rows: habitRows } = useQuery<{ date: DateKey; count: number }>(
    'SELECT date, count FROM habit_logs WHERE habit_id = $habit AND count > 0 AND date BETWEEN $from AND $to',
    { ...range, $habit: habitId },
    ['habit_logs'],
  );

  const data: PixelData = {
    moods: new Map(moodRows.map((row) => [row.date, row.mood])),
    sleep: new Map(sleepRows.map((row) => [row.date, row.duration_min])),
    workouts: new Map(workoutRows.map((row) => [row.date, { count: row.count, minutes: row.minutes }])),
    habit,
    habitCounts: new Map(habitRows.map((row) => [row.date, row.count])),
  };

  const color =
    metric === 'mood'
      ? colors.journal
      : metric === 'sleep'
        ? colors.accent
        : metric === 'workouts'
          ? colors.activity
          : paletteColor(habit?.color ?? 'green', dark);
  const levels = metricLevels(metric);
  const labels = legendLabels(metric, habit);

  const changeMetric = (next: PixelMetric) => {
    setMetric(next);
    setSelectedDay(null);
  };
  const changeYear = (next: number) => {
    setYear(next);
    setSelectedDay(null);
  };

  const summary = () => {
    if (metric === 'mood') {
      if (!moodRows.length) return 'Brak ocen nastroju w tym roku.';
      const average = moodRows.reduce((sum, row) => sum + row.mood, 0) / moodRows.length;
      return `Średni nastrój ${formatDecimal(average, 1)} · ${plural(moodRows.length, ['dzień', 'dni', 'dni'])} z oceną`;
    }
    if (metric === 'sleep') {
      if (!sleepRows.length) return 'Brak zapisów snu w tym roku.';
      const average = sleepRows.reduce((sum, row) => sum + row.duration_min, 0) / sleepRows.length;
      return `Średnio ${formatDuration(Math.round(average))} · ${plural(sleepRows.length, ['noc', 'noce', 'nocy'])}`;
    }
    if (metric === 'workouts') {
      const count = workoutRows.reduce((sum, row) => sum + row.count, 0);
      const minutes = workoutRows.reduce((sum, row) => sum + row.minutes, 0);
      if (!count) return 'Brak treningów w tym roku.';
      return `${plural(count, ['trening', 'treningi', 'treningów'])} w ${plural(workoutRows.length, ['dzień', 'dni', 'dni'])}${minutes ? ` · ${formatDuration(minutes)}` : ''}`;
    }
    if (!habit) return '';
    const done = habitRows.filter((row) => row.count >= habit.target_per_day).length;
    return `Cel osiągnięty ${plural(done, ['raz', 'razy', 'razy'])} w tym roku`;
  };

  return (
    <ScrollScreen title="Rok w pikselach" gap={spacing.lg}>
      <PeriodNavigator
        title={String(year)}
        onPrevious={() => changeYear(year - 1)}
        onNext={() => changeYear(year + 1)}
        canGoNext={year < currentYear}
        unitLabel={{ previous: 'Poprzedni rok', next: 'Następny rok' }}
      />

      <ChipRow scroll>
        <Chip label="Nastrój" icon="mood" iconColor={colors.journal} selected={metric === 'mood'} onPress={() => changeMetric('mood')} />
        <Chip label="Sen" icon="bedtime" iconColor={colors.accent} selected={metric === 'sleep'} onPress={() => changeMetric('sleep')} />
        <Chip
          label="Treningi"
          icon="fitness_center"
          iconColor={colors.activity}
          selected={metric === 'workouts'}
          onPress={() => changeMetric('workouts')}
        />
        {habits.map((item) => (
          <Chip
            key={item.id}
            label={`${item.icon} ${item.name}`}
            selected={metric === `habit:${item.id}`}
            onPress={() => changeMetric(`habit:${item.id}`)}
          />
        ))}
      </ChipRow>

      <Card style={styles.card}>
        <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
          {selectedDay ? `${formatDayLong(selectedDay)} · ${pixelReadout(metric, selectedDay, data)}` : summary()}
        </AppText>

        <View style={styles.grid}>
          <View style={styles.row}>
            <View style={styles.dayLabel} />
            {MONTH_INDEXES.map((month) => (
              <AppText key={month} variant="caption" tone="textMuted" style={styles.monthLabel} numberOfLines={1}>
                {MONTHS_SHORT[month]}
              </AppText>
            ))}
          </View>
          {DAYS.map((dayOfMonth) => (
            <View key={dayOfMonth} style={styles.row}>
              <AppText variant="caption" tone="textMuted" style={styles.dayLabel}>
                {dayOfMonth === 1 || dayOfMonth % 5 === 0 ? dayOfMonth : ''}
              </AppText>
              {MONTH_INDEXES.map((month) => {
                const day = yearDay(year, month, dayOfMonth);
                if (!day) return <View key={month} style={styles.cell} />;
                if (day > today) {
                  return <View key={month} style={[styles.cell, styles.future, { borderColor: colors.border }]} />;
                }
                const level = pixelLevel(metric, day, data);
                const background =
                  level === null ? 'transparent' : level === 0 ? colors.surfaceAlt : withAlpha(color, levelAlpha(level, levels));
                const selected = day === selectedDay;
                return (
                  <Pressable
                    key={month}
                    accessibilityLabel={`${formatDayLong(day)}: ${pixelReadout(metric, day, data)}`}
                    onPress={() => setSelectedDay(selected ? null : day)}
                    style={[
                      styles.cell,
                      { backgroundColor: background },
                      level === null && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                      selected && { borderWidth: 2, borderColor: colors.text },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.legend}>
          <LegendItem color={colors.surfaceAlt} label="Brak" />
          {labels.map((label, index) =>
            label ? <LegendItem key={index} color={withAlpha(color, levelAlpha(index + 1, levels))} label={label} /> : null,
          )}
        </View>
      </Card>
      <AppText variant="caption" tone="textMuted">
        Stuknij w kratkę, żeby zobaczyć szczegóły dnia.
      </AppText>
    </ScrollScreen>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <AppText variant="caption" tone="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md },
  grid: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dayLabel: { width: DAY_LABEL_WIDTH, fontSize: 10, lineHeight: CELL_HEIGHT, textAlign: 'right', paddingRight: 2 },
  monthLabel: { flex: 1, fontSize: 10, textAlign: 'center' },
  cell: { flex: 1, height: CELL_HEIGHT, borderRadius: 3 },
  future: { borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
});
