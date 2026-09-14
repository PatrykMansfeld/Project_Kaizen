import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyLine } from '@/components/empty-state';
import { Section } from '@/components/section';
import { SLEEP_QUALITY, SLEEP_RANGE_SQL, type SleepLog } from '@/db/sleep';
import { useQuery } from '@/db/use-query';
import { ColumnChart, StatRow, StatTile } from '@/features/stats/charts';
import { formatDayLong, type DateKey } from '@/lib/dates';
import { formatDecimal, formatDuration, plural } from '@/lib/format';
import { useTheme } from '@/theme/use-theme';

import { dayAxisLabel, versus, type SectionProps } from './shared';

export function SleepSection({ range, period }: SectionProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<DateKey | null>(null);
  const { rows } = useQuery<SleepLog>(SLEEP_RANGE_SQL, { $from: range.prevFrom, $to: range.to }, ['sleep_logs']);

  const current = rows.filter((row) => row.date >= range.from);
  const previous = rows.filter((row) => row.date <= range.prevTo);
  const average = (list: number[]) => (list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null);
  const avgMinutes = average(current.map((row) => row.duration_min));
  const prevMinutes = average(previous.map((row) => row.duration_min));
  const qualities = current.map((row) => row.quality).filter((value): value is number => value !== null);
  const avgQuality = average(qualities);
  const byDay = new Map(current.map((row) => [row.date, row]));
  const maxHours = Math.max(9, ...current.map((row) => row.duration_min / 60));
  const selectedEntry = selected ? byDay.get(selected) : undefined;

  return (
    <Section icon="bedtime" color={colors.accent} title="Sen">
      {current.length === 0 ? (
        <EmptyLine text="Brak zapisanego snu w tym okresie. Dodasz go na ekranie Dziś." />
      ) : (
        <>
          <StatRow>
            <StatTile
              label="Średnio"
              value={avgMinutes === null ? '—' : formatDuration(Math.round(avgMinutes))}
              detail={
                avgMinutes !== null && prevMinutes !== null
                  ? versus(Math.round(avgMinutes - prevMinutes), period, formatDuration)
                  : plural(current.length, ['noc', 'noce', 'nocy'])
              }
            />
            <StatTile
              label="Jakość"
              value={avgQuality === null ? '—' : `${SLEEP_QUALITY[Math.round(avgQuality) - 1].emoji} ${formatDecimal(avgQuality, 1)}`}
              detail="w skali 1–5"
            />
          </StatRow>
          <Card>
            <AppText variant="caption" tone="textSecondary">
              {selectedEntry
                ? `${formatDayLong(selectedEntry.date)}: ${formatDuration(selectedEntry.duration_min)} (${selectedEntry.bedtime}–${selectedEntry.wake_time})`
                : 'Godziny snu w kolejnych nocach — stuknij słupek.'}
            </AppText>
            <ColumnChart
              columns={range.days.map((day, index) => {
                const entry = byDay.get(day);
                return {
                  key: day,
                  value: entry ? entry.duration_min / 60 : 0,
                  axisLabel: dayAxisLabel(period, range.days, index),
                  accessibilityLabel: `${formatDayLong(day)}: ${entry ? formatDuration(entry.duration_min) : 'brak wpisu'}`,
                };
              })}
              max={maxHours}
              color={colors.accent}
              height={120}
              gridLines={[4, 6, 8]}
              selectedKey={selected}
              onSelect={(key) => setSelected(key === selected ? null : key)}
            />
          </Card>
        </>
      )}
    </Section>
  );
}
