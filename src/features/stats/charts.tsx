import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/**
 * Proste wykresy na widokach RN. Zasady: jedna seria = jeden kolor modułu, cienkie słupki
 * (≤ 24 px) z zaokrąglonym czubkiem i prostą podstawą, 2 px przerwy, siatka jako cienkie
 * ciągłe linie, tekst zawsze w kolorach tekstu (nie w kolorze serii).
 */

export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  const { colors, cardBorderWidth } = useTheme();
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: colors.surface },
        // Ramka zawsze podana (w stylu klasycznym 0), bo usunięcie jej na Androidzie potrafi schować treść karty.
        { borderWidth: cardBorderWidth, borderColor: cardBorderWidth > 0 ? colors.cardBorder : 'transparent' },
      ]}>
      <AppText variant="caption" tone="textSecondary">
        {label}
      </AppText>
      <AppText variant="heading">{value}</AppText>
      {detail ? (
        <AppText variant="caption" tone="textMuted" numberOfLines={1}>
          {detail}
        </AppText>
      ) : null}
    </View>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <View style={styles.statRow}>{children}</View>;
}

/** Pasek postępu: tor to jaśniejszy odcień tego samego koloru co wypełnienie. */
export function Meter({ value, color }: { value: number; color: string }) {
  return (
    <View style={[styles.meterTrack, { backgroundColor: withAlpha(color, 0.18) }]}>
      <View style={[styles.meterFill, { width: `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

export type Column = {
  key: string;
  value: number;
  /** Podpis wartości nad słupkiem (tylko przy `showValues`). */
  valueLabel?: string;
  /** Podpis osi X pod słupkiem — podawaj wybiórczo, nie przy każdym. */
  axisLabel?: string;
  accessibilityLabel: string;
};

type ColumnChartProps = {
  columns: Column[];
  max: number;
  color: string;
  height?: number;
  /** Poziomy linii siatki (w jednostkach wartości). */
  gridLines?: number[];
  showValues?: boolean;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
};

const VALUE_BAND = 18;
const AXIS_BAND = 18;

/** Wykres kolumnowy: jedna seria, stuknięcie w kolumnę ją wyróżnia (odczyt wartości nad wykresem). */
export function ColumnChart({
  columns,
  max,
  color,
  height = 140,
  gridLines = [],
  showValues = false,
  selectedKey = null,
  onSelect,
}: ColumnChartProps) {
  const { colors } = useTheme();
  const plot = height - (showValues ? VALUE_BAND : 0);
  // Gęste wykresy (np. 30 dni) dostają mniejsze zaokrąglenie, żeby słupek nie stał się pigułką.
  const capRadius = columns.length > 14 ? 2 : 4;

  return (
    <View>
      <View style={{ height }}>
        {gridLines.map((level) => (
          <View
            key={level}
            style={[styles.gridLine, { bottom: (level / max) * plot, backgroundColor: colors.border }]}
          />
        ))}
        <View style={[styles.columns, { height }]}>
          {columns.map((column) => {
            const dimmed = selectedKey !== null && selectedKey !== column.key;
            return (
              <Pressable
                key={column.key}
                onPress={() => onSelect?.(column.key)}
                disabled={!onSelect}
                accessibilityLabel={column.accessibilityLabel}
                style={styles.column}>
                {showValues && column.value > 0 ? (
                  <AppText variant="caption" tone="textSecondary" numberOfLines={1} style={styles.valueLabel}>
                    {column.valueLabel ?? String(column.value)}
                  </AppText>
                ) : null}
                {column.value > 0 ? (
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max((column.value / max) * plot, 2),
                        backgroundColor: color,
                        opacity: dimmed ? 0.35 : 1,
                        borderTopLeftRadius: capRadius,
                        borderTopRightRadius: capRadius,
                      },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.baseline, { backgroundColor: colors.border }]} />
      </View>
      <View style={[styles.axis, { height: AXIS_BAND }]}>
        {columns.map((column) => (
          <View key={column.key} style={styles.axisCell}>
            {column.axisLabel ? (
              <AppText variant="caption" tone="textMuted" numberOfLines={1} style={styles.axisLabel}>
                {column.axisLabel}
              </AppText>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export type BarItem = { key: string; label: string; value: number; valueLabel?: string };

/** Poziome słupki z podpisem po lewej i wartością przy końcu słupka. */
export function BarList({ items, max, color }: { items: BarItem[]; max: number; color: string }) {
  return (
    <View style={styles.barList}>
      {items.map((item) => (
        <View key={item.key} style={styles.barRow} accessibilityLabel={`${item.label}: ${item.valueLabel ?? item.value}`}>
          <AppText variant="caption" tone="textSecondary" numberOfLines={1} style={styles.barLabel}>
            {item.label}
          </AppText>
          <View style={styles.barTrack}>
            {item.value > 0 ? (
              // 85% toru na słupek, reszta na wartość przy jego końcu.
              <View style={[styles.hBar, { width: `${(item.value / max) * 85}%`, backgroundColor: color }]} />
            ) : null}
            <AppText variant="caption" tone="textSecondary" style={styles.barValue}>
              {item.valueLabel ?? String(item.value)}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, gap: 2, padding: spacing.md, borderRadius: radius.md },
  meterTrack: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: radius.full },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  baseline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  columns: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  column: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '100%', maxWidth: 24 },
  valueLabel: { marginBottom: 2 },
  axis: { flexDirection: 'row', gap: 2, marginTop: spacing.xs },
  axisCell: { flex: 1, alignItems: 'center', overflow: 'visible' },
  axisLabel: { width: 48, textAlign: 'center' },
  barList: { gap: spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 96 },
  barTrack: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  hBar: { height: 14, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  barValue: { minWidth: 24 },
});
