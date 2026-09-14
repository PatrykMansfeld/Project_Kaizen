import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyLine } from '@/components/empty-state';
import { Section } from '@/components/section';
import { useQuery } from '@/db/use-query';
import { WORKOUT_TYPES, WORKOUT_TYPE_KEYS, type WorkoutType } from '@/features/activity/workout-types';
import { BarList, ColumnChart, StatRow, StatTile } from '@/features/stats/charts';
import { periodRange, weeklyActivity } from '@/features/stats/compute';
import { WEEKDAYS_SHORT, formatDayLong, weekdayIndex, type DateKey } from '@/lib/dates';
import { FORMS, formatDecimal, formatDuration, plural } from '@/lib/format';
import { useTheme } from '@/theme/use-theme';

import { versus, type SectionProps } from './shared';

type WorkoutStatRow = { date: DateKey; type: WorkoutType; duration_min: number | null; distance_km: number | null };

export function ActivitySection({ range, period }: SectionProps) {
  const { colors } = useTheme();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { rows: workouts } = useQuery<WorkoutStatRow>(
    'SELECT date, type, duration_min, distance_km FROM workouts WHERE date BETWEEN $from AND $to',
    { $from: range.prevFrom, $to: range.to },
    ['workouts'],
  );

  const inRange = workouts.filter((workout) => workout.date >= range.from && workout.date <= range.to);
  const inPrevious = workouts.filter((workout) => workout.date <= range.prevTo);
  const minutesOf = (list: WorkoutStatRow[]) => list.reduce((sum, workout) => sum + (workout.duration_min ?? 0), 0);
  const minutes = minutesOf(inRange);
  const km = inRange.reduce((sum, workout) => sum + (workout.distance_km ?? 0), 0);

  // Tydzień: minuty w kolejnych dniach. Miesiąc: w kolejnych tygodniach (od poniedziałku).
  const buckets =
    period === 'week'
      ? range.days.map((day) => {
          const list = inRange.filter((workout) => workout.date === day);
          return { start: day, minutes: minutesOf(list), count: list.length };
        })
      : weeklyActivity(inRange, [...new Set(range.days.map(shiftToMonday))]);
  const maxMinutes = Math.max(...buckets.map((bucket) => bucket.minutes), 1);
  const bucketLabel = (start: DateKey) =>
    period === 'week' ? WEEKDAYS_SHORT[weekdayIndex(start)] : `${Number(start.slice(8))}.${start.slice(5, 7)}`;
  const selected = buckets.find((bucket) => bucket.start === selectedKey);

  const byType = WORKOUT_TYPE_KEYS.map((type) => ({ type, count: inRange.filter((workout) => workout.type === type).length }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <Section icon="directions_run" color={colors.activity} title="Aktywność">
      {inRange.length === 0 ? (
        <EmptyLine text={`Brak treningów w tym ${period === 'week' ? 'tygodniu' : 'miesiącu'}.`} />
      ) : (
        <>
          <StatRow>
            <StatTile
              label="Treningi"
              value={String(inRange.length)}
              detail={versus(inRange.length - inPrevious.length, period, String)}
            />
            <StatTile
              label="Czas"
              value={formatDuration(minutes)}
              detail={versus(minutes - minutesOf(inPrevious), period, formatDuration)}
            />
            <StatTile label="Dystans" value={`${formatDecimal(km, 1)} km`} />
          </StatRow>
          <Card>
            <AppText variant="caption" tone="textSecondary">
              {selected
                ? `${period === 'week' ? formatDayLong(selected.start) : `Tydzień od ${bucketLabel(selected.start)}`}: ${formatDuration(selected.minutes)}, ${plural(selected.count, FORMS.workout)}`
                : period === 'week'
                  ? 'Minuty treningu w kolejnych dniach'
                  : 'Minuty treningu w kolejnych tygodniach'}
            </AppText>
            <ColumnChart
              columns={buckets.map((bucket) => ({
                key: bucket.start,
                value: bucket.minutes,
                valueLabel: formatDuration(bucket.minutes),
                axisLabel: bucketLabel(bucket.start),
                accessibilityLabel: `${bucketLabel(bucket.start)}: ${formatDuration(bucket.minutes)}`,
              }))}
              max={maxMinutes}
              color={colors.activity}
              height={140}
              showValues={period === 'month'}
              selectedKey={selectedKey}
              onSelect={(key) => setSelectedKey(key === selectedKey ? null : key)}
            />
          </Card>
          <Card>
            <BarList
              items={byType.map(({ type, count }) => ({ key: type, label: WORKOUT_TYPES[type].label, value: count }))}
              max={Math.max(...byType.map((item) => item.count), 1)}
              color={colors.activity}
            />
          </Card>
        </>
      )}
    </Section>
  );
}

/** Poniedziałek tygodnia, w którym leży dzień (dla kubełków miesiąca). */
function shiftToMonday(day: DateKey) {
  return periodRange('week', day).from;
}
