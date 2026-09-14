import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyLine } from '@/components/empty-state';
import { Section } from '@/components/section';
import { MOODS_RANGE_SQL, type MoodRow } from '@/db/journal';
import { useQuery } from '@/db/use-query';
import { MOODS, moodOf } from '@/features/journal/moods';
import { BarList, ColumnChart, StatRow, StatTile } from '@/features/stats/charts';
import { moodStats } from '@/features/stats/compute';
import { formatDayLong, type DateKey } from '@/lib/dates';
import { formatDecimal, plural } from '@/lib/format';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { dayAxisLabel, versus, type SectionProps } from './shared';

const MOOD_CHART_HEIGHT = 120;
const MOOD_EMOJI_SIZE = 16;

export function MoodSection({ range, period }: SectionProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<DateKey | null>(null);
  const { rows: entries } = useQuery<MoodRow>(MOODS_RANGE_SQL, { $from: range.prevFrom, $to: range.to }, ['journal_entries']);

  const current = entries.filter((entry) => entry.date >= range.from);
  const previous = entries.filter((entry) => entry.date <= range.prevTo);
  const byDay = new Map(current.map((entry) => [entry.date, entry.mood]));
  const { counts, average } = moodStats(current.map((entry) => entry.mood));
  const previousAverage = moodStats(previous.map((entry) => entry.mood)).average;
  const days = range.days;
  const selectedMood = selected ? moodOf(byDay.get(selected) ?? null) : null;

  return (
    <Section icon="mood" color={colors.journal} title="Nastrój">
      {current.length === 0 ? (
        <EmptyLine text={`Brak ocen nastroju w tym ${period === 'week' ? 'tygodniu' : 'miesiącu'}. Dodasz je w dzienniku.`} />
      ) : (
        <>
          <StatRow>
            <StatTile
              label="Średni nastrój"
              value={average === null ? '—' : `${moodOf(Math.round(average))?.emoji ?? ''} ${formatDecimal(average, 1)}`}
              detail={
                average !== null && previousAverage !== null
                  ? versus(Number((average - previousAverage).toFixed(1)), period, (value) => formatDecimal(value, 1))
                  : 'w skali 1–5'
              }
            />
            <StatTile label="Oceny" value={String(current.length)} detail={`z ${plural(days.length, ['dnia', 'dni', 'dni'])}`} />
          </StatRow>
          <Card>
            <AppText variant="caption" tone="textSecondary">
              {selected
                ? `${formatDayLong(selected)}: ${selectedMood ? `${selectedMood.emoji} ${selectedMood.label}` : 'brak oceny'}`
                : 'Stuknij słupek, żeby zobaczyć dzień.'}
            </AppText>
            <View style={styles.moodChart}>
              <View style={styles.moodAxis}>
                {[5, 3, 1].map((value) => (
                  <Text
                    key={value}
                    style={[styles.moodAxisEmoji, { bottom: (value / 5) * MOOD_CHART_HEIGHT - MOOD_EMOJI_SIZE / 2 }]}>
                    {moodOf(value)?.emoji}
                  </Text>
                ))}
              </View>
              <View style={styles.flex}>
                <ColumnChart
                  columns={days.map((day, index) => {
                    const mood = byDay.get(day) ?? 0;
                    return {
                      key: day,
                      value: mood,
                      axisLabel: dayAxisLabel(period, days, index),
                      accessibilityLabel: `${formatDayLong(day)}: ${mood ? moodOf(mood)?.label : 'brak oceny'}`,
                    };
                  })}
                  max={5}
                  color={colors.journal}
                  height={MOOD_CHART_HEIGHT}
                  gridLines={[1, 2, 3, 4, 5]}
                  selectedKey={selected}
                  onSelect={(key) => setSelected(key === selected ? null : key)}
                />
              </View>
            </View>
          </Card>
          <Card>
            <BarList
              items={[...MOODS].reverse().map((mood) => ({
                key: String(mood.value),
                label: `${mood.emoji} ${mood.label}`,
                value: counts[mood.value - 1],
              }))}
              max={Math.max(...counts, 1)}
              color={colors.journal}
            />
          </Card>
        </>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  moodChart: { flexDirection: 'row', gap: spacing.sm },
  // Emoji skali na wysokości linii siatki 5, 3 i 1.
  moodAxis: { width: MOOD_EMOJI_SIZE + 4, height: MOOD_CHART_HEIGHT },
  moodAxisEmoji: { position: 'absolute', left: 0, fontSize: MOOD_EMOJI_SIZE - 2, lineHeight: MOOD_EMOJI_SIZE },
});
