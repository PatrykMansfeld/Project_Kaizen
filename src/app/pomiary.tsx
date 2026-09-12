import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { Chip, ChipRow } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { StackHeader, useListScreenStyle } from '@/components/screen';
import { Separator } from '@/components/separator';
import {
  MEASUREMENTS_SQL,
  MEASUREMENT_TYPES,
  MEASUREMENT_TYPE_KEYS,
  type Measurement,
  type MeasurementType,
} from '@/db/measurements';
import { useQuery } from '@/db/use-query';
import { StatRow, StatTile } from '@/features/stats/charts';
import { LineChart } from '@/features/stats/line-chart';
import { addDays, diffDays, formatDayRelative, formatDayShort } from '@/lib/dates';
import { formatDecimal, formatSigned } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const RANGES = [
  { days: 30, label: '30 dni' },
  { days: 90, label: '90 dni' },
  { days: null, label: 'Wszystko' },
] as const;

/** „−1,2 kg”, „+0,5 cm” */
function signed(value: number, unit: string) {
  return formatSigned(value, (absolute) => `${formatDecimal(absolute, 1)} ${unit}`);
}

export default function MeasurementsScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const listStyle = useListScreenStyle();
  const [type, setType] = useState<MeasurementType>('weight');
  const [range, setRange] = useState<number | null>(90);
  const [selected, setSelected] = useState<string | null>(null);
  const { rows: entries, loaded } = useQuery<Measurement>(MEASUREMENTS_SQL, { $type: type }, ['measurements']);
  const { unit, label } = MEASUREMENT_TYPES[type];

  const latest = entries[0];
  // Zmiana: ostatni pomiar względem ostatniego sprzed ≥ 30 dni (albo najstarszego, jeśli historia krótsza).
  const baseline = latest
    ? (entries.find((entry) => entry.date <= addDays(latest.date, -30)) ?? (entries.length > 1 ? entries[entries.length - 1] : null))
    : null;

  const inRange = range === null ? entries : entries.filter((entry) => entry.date >= addDays(today, -range));
  const chronological = [...inRange].reverse();
  const selectedEntry = entries.find((entry) => String(entry.id) === selected);

  const openEntry = (id: number | 'nowy') =>
    router.push({ pathname: '/pomiar/[id]', params: { id: String(id), type } });

  return (
    <>
      <StackHeader
        title="Pomiary ciała"
        headerRight={<IconButton icon="add" accessibilityLabel="Nowy pomiar" onPress={() => openEntry('nowy')} />}
      />
      <FlatList
        {...listStyle}
        data={entries}
        keyExtractor={(entry) => String(entry.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <ChipRow scroll>
              {MEASUREMENT_TYPE_KEYS.map((key) => (
                <Chip
                  key={key}
                  label={MEASUREMENT_TYPES[key].label}
                  selected={type === key}
                  onPress={() => {
                    setType(key);
                    setSelected(null);
                  }}
                />
              ))}
            </ChipRow>

            {latest ? (
              <>
                <StatRow>
                  <StatTile
                    label="Obecnie"
                    value={`${formatDecimal(latest.value, 1)} ${unit}`}
                    detail={formatDayRelative(latest.date, today)}
                  />
                  <StatTile
                    label="Zmiana"
                    value={baseline ? signed(latest.value - baseline.value, unit) : '—'}
                    detail={baseline ? `od ${formatDayShort(baseline.date, today)}` : 'potrzebne 2 pomiary'}
                  />
                </StatRow>

                <Card>
                  <ChipRow>
                    {RANGES.map((option) => (
                      <Chip
                        key={option.label}
                        label={option.label}
                        selected={range === option.days}
                        onPress={() => setRange(option.days)}
                      />
                    ))}
                  </ChipRow>
                  <AppText variant="caption" tone="textSecondary">
                    {selectedEntry
                      ? `${formatDayShort(selectedEntry.date, today)}: ${formatDecimal(selectedEntry.value, 1)} ${unit}`
                      : `${label} (${unit}) — stuknij wykres, żeby zobaczyć pomiar`}
                  </AppText>
                  {chronological.length > 0 ? (
                    <LineChart
                      points={chronological.map((entry) => ({
                        key: String(entry.id),
                        x: diffDays(chronological[0].date, entry.date),
                        y: entry.value,
                      }))}
                      color={colors.activity}
                      selectedKey={selected}
                      onSelect={setSelected}
                    />
                  ) : (
                    <AppText variant="caption" tone="textMuted">
                      Brak pomiarów w tym okresie.
                    </AppText>
                  )}
                </Card>

                <AppText variant="label" tone="textSecondary">
                  Historia
                </AppText>
              </>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const previous = entries[index + 1];
          return (
            <Card variant="row" onPress={() => openEntry(item.id)}>
              <AppText style={styles.flex}>{formatDayRelative(item.date, today)}</AppText>
              {previous ? (
                <AppText variant="caption" tone="textMuted">
                  {signed(item.value - previous.value, unit)}
                </AppText>
              ) : null}
              <AppText variant="bodyStrong">
                {formatDecimal(item.value, 1)} {unit}
              </AppText>
            </Card>
          );
        }}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          loaded ? (
            <EmptyState
              icon="monitor_weight"
              color={colors.activity}
              title={`Brak pomiarów: ${label.toLowerCase()}`}
              description="Dodaj pierwszy pomiar przyciskiem + w nagłówku."
            />
          ) : null
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.lg, paddingBottom: spacing.sm },
  flex: { flex: 1 },
});
