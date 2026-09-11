import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
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
import { addDays, diffDays, formatDayShort, relativeDayLabel } from '@/lib/dates';
import { formatDecimal } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const RANGES = [
  { days: 30, label: '30 dni' },
  { days: 90, label: '90 dni' },
  { days: null, label: 'Wszystko' },
] as const;

/** „−1,2 kg”, „+0,5 cm” */
function signed(value: number, unit: string) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${formatDecimal(Math.abs(value), 1)} ${unit}`;
}

export default function MeasurementsScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
      <Stack.Screen
        options={{
          title: 'Pomiary ciała',
          headerRight: () => (
            <IconButton icon="add" accessibilityLabel="Nowy pomiar" onPress={() => openEntry('nowy')} />
          ),
        }}
      />
      <FlatList
        data={entries}
        keyExtractor={(entry) => String(entry.id)}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
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
            </ScrollView>

            {latest ? (
              <>
                <StatRow>
                  <StatTile
                    label="Obecnie"
                    value={`${formatDecimal(latest.value, 1)} ${unit}`}
                    detail={relativeDayLabel(latest.date, today) ?? formatDayShort(latest.date, today)}
                  />
                  <StatTile
                    label="Zmiana"
                    value={baseline ? signed(latest.value - baseline.value, unit) : '—'}
                    detail={baseline ? `od ${formatDayShort(baseline.date, today)}` : 'potrzebne 2 pomiary'}
                  />
                </StatRow>

                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                  <View style={styles.chips}>
                    {RANGES.map((option) => (
                      <Chip
                        key={option.label}
                        label={option.label}
                        selected={range === option.days}
                        onPress={() => setRange(option.days)}
                      />
                    ))}
                  </View>
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
                </View>

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
            <Pressable
              onPress={() => openEntry(item.id)}
              android_ripple={{ color: colors.border }}
              style={[styles.row, { backgroundColor: colors.surface }]}>
              <AppText style={styles.flex}>{relativeDayLabel(item.date, today) ?? formatDayShort(item.date, today)}</AppText>
              {previous ? (
                <AppText variant="caption" tone="textMuted">
                  {signed(item.value - previous.value, unit)}
                </AppText>
              ) : null}
              <AppText variant="bodyStrong">
                {formatDecimal(item.value, 1)} {unit}
              </AppText>
            </Pressable>
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

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.lg },
  header: { gap: spacing.lg, paddingBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  flex: { flex: 1 },
  separator: { height: spacing.sm },
});
