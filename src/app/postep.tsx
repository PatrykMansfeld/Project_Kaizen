import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconBadge } from '@/components/icon-badge';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import type { Attribute } from '@/db/habits';
import {
  ATTRIBUTES,
  ATTRIBUTE_KEYS,
  XP_SOURCES,
  XP_SOURCE_KEYS,
  formatXp,
  laggingAttribute,
  weekChange,
  type XpSource,
  type XpSummary,
} from '@/features/progress/xp';
import { useXp } from '@/features/progress/xp-provider';
import { BarList, ColumnChart, Meter, StatRow, StatTile } from '@/features/stats/charts';
import { addDays, formatDateRange, fromDateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Postęp: poziom, cztery cechy, tydzień do tygodnia, skąd są punkty i za co się je dostaje. */
export default function ProgressScreen() {
  const summary = useXp();
  const { colors } = useTheme();

  if (!summary) return <ScrollScreen title="Postęp">{null}</ScrollScreen>;

  const { level } = summary;
  const lagging = laggingAttribute(summary.last30.attributes);

  return (
    <ScrollScreen title="Postęp">
      <Card style={styles.hero}>
        <View style={styles.heroRow}>
          <AppText variant="title">Poziom {level.level}</AppText>
          <AppText tone="textSecondary">{formatXp(summary.total)}</AppText>
        </View>
        <Meter value={level.progress} color={colors.accent} />
        <AppText variant="caption" tone="textSecondary">
          {formatXp(level.xp - level.from)} z {formatXp(level.to - level.from)} · do poziomu {level.level + 1} brakuje{' '}
          {formatXp(level.to - level.xp)}
        </AppText>
      </Card>

      <WeekTiles summary={summary} />

      <Section title="Cechy">
        <Card style={styles.attributes}>
          {ATTRIBUTE_KEYS.map((key) => (
            <AttributeRow key={key} attribute={key} summary={summary} />
          ))}
        </Card>
        {lagging ? (
          <Card style={[styles.hint, { backgroundColor: colors.surfaceAlt }]}>
            <AppText variant="bodyStrong">{ATTRIBUTES[lagging].label} zostaje w tyle</AppText>
            <AppText tone="textSecondary">
              W ostatnich 30 dniach {formatXp(summary.last30.attributes[lagging])}. Pomoże: {ATTRIBUTES[lagging].boost}.
            </AppText>
          </Card>
        ) : null}
        <Button label="Cechy nawyków" icon="tune" variant="secondary" onPress={() => router.push('/cechy-nawykow')} />
      </Section>

      <WeeksChart summary={summary} />

      <SourcesSection summary={summary} />

      <Section title="Za co są punkty">
        <Card style={styles.rules}>
          {XP_SOURCE_KEYS.map((source) => (
            <RuleRow key={source} source={source} />
          ))}
        </Card>
        <AppText variant="caption" tone="textMuted">
          Punkty liczą się z tego, co zapisujesz — odznaczenie nawyku albo usunięcie treningu je zabiera. Opuszczony dzień
          niczego nie odbiera.
        </AppText>
      </Section>
    </ScrollScreen>
  );
}

function WeekTiles({ summary }: { summary: XpSummary }) {
  const change = weekChange(summary);
  const changeText =
    change === null ? 'zeszły tydzień bez punktów' : `${change > 0 ? '+' : change < 0 ? '−' : '±'}${Math.abs(change)}% do zeszłego`;
  return (
    <StatRow>
      <StatTile label="Dziś" value={`+${summary.today}`} detail="XP" />
      <StatTile label="Ten tydzień" value={String(summary.thisWeek)} detail={changeText} />
      <StatTile label="30 dni" value={String(summary.last30.total)} detail={`średnio ${Math.round(summary.last30.total / 30)} dziennie`} />
    </StatRow>
  );
}

function AttributeRow({ attribute, summary }: { attribute: Attribute; summary: XpSummary }) {
  const { colors } = useTheme();
  const info = ATTRIBUTES[attribute];
  const color = colors[info.color];
  const { xp, level } = summary.attributes[attribute];
  return (
    <View style={styles.attributeRow} accessibilityLabel={`${info.label}: poziom ${level.level}, ${xp} XP`}>
      <IconBadge icon={info.icon} color={color} size={40} />
      <View style={styles.flex}>
        <View style={styles.heroRow}>
          <AppText variant="bodyStrong">{info.label}</AppText>
          <AppText variant="caption" tone="textSecondary">
            Poz. {level.level} · {formatXp(xp)}
          </AppText>
        </View>
        <Meter value={level.progress} color={color} />
      </View>
    </View>
  );
}

function WeeksChart({ summary }: { summary: XpSummary }) {
  const { colors } = useTheme();
  const today = useToday();
  const [selected, setSelected] = useState<string | null>(null);
  const weeks = summary.weeks;
  const current = weeks.find((week) => week.start === selected) ?? weeks[weeks.length - 1];
  const max = Math.max(...weeks.map((week) => week.xp), 100);
  const label = (start: string) => {
    const date = fromDateKey(start);
    return `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  return (
    <Section title="Ostatnie 12 tygodni">
      <Card style={styles.chart}>
        <AppText variant="caption" tone="textSecondary">
          {formatDateRange(current.start, addDays(current.start, 6), today)}
        </AppText>
        <AppText variant="heading">{formatXp(current.xp)}</AppText>
        <ColumnChart
          columns={weeks.map((week, index) => ({
            key: week.start,
            value: week.xp,
            axisLabel: index % 3 === 2 ? label(week.start) : undefined,
            accessibilityLabel: `Tydzień od ${label(week.start)}: ${week.xp} XP`,
          }))}
          max={max}
          color={colors.accent}
          selectedKey={current.start}
          onSelect={setSelected}
        />
      </Card>
    </Section>
  );
}

function SourcesSection({ summary }: { summary: XpSummary }) {
  const { colors } = useTheme();
  const items = (Object.entries(summary.last30.sources) as [XpSource, number][])
    .filter(([, xp]) => xp > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([source, xp]) => ({ key: source, label: XP_SOURCES[source].label, value: xp, valueLabel: String(xp) }));

  return (
    <Section title="Skąd punkty · 30 dni">
      {items.length ? (
        <Card style={styles.chart}>
          <BarList items={items} max={items[0].value} color={colors.accent} />
        </Card>
      ) : (
        <AppText tone="textSecondary">Odhacz nawyk, zrób zadanie albo zapisz trening — pierwsze punkty pojawią się tutaj.</AppText>
      )}
    </Section>
  );
}

function RuleRow({ source }: { source: XpSource }) {
  const { colors } = useTheme();
  const info = XP_SOURCES[source];
  const attribute = info.attribute ? ATTRIBUTES[info.attribute] : null;
  const detail = [attribute ? attribute.label : source === 'habit' ? 'cecha nawyku' : 'cecha celu', info.limit ? `limit ${info.limit}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.ruleRow}>
      <View style={[styles.dot, { backgroundColor: attribute ? colors[attribute.color] : colors.textMuted }]} />
      <View style={styles.flex}>
        <AppText>{info.rule}</AppText>
        <AppText variant="caption" tone="textMuted">
          {detail}
        </AppText>
      </View>
      <AppText variant="bodyStrong">{info.xp}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  attributes: { gap: spacing.lg },
  attributeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xs },
  hint: { gap: spacing.xs },
  chart: { gap: spacing.sm },
  rules: { gap: spacing.md },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
