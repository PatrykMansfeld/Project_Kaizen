import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Icon, type IconName } from '@/components/icon';
import { PeriodNavigator } from '@/components/period-navigator';
import { ScrollScreen } from '@/components/screen';
import { useModuleVisible } from '@/features/modules/preferences';
import { periodRange, shiftPeriod, type Period, type PeriodRange } from '@/features/stats/compute';
import { MONTHS, formatDateRange, fromDateKey, type DateKey } from '@/lib/dates';
import { capitalize } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { HabitsSection } from './sections/habits-section';
import { TasksSection } from './sections/tasks-section';
import { ActivitySection } from './sections/activity-section';
import { MoodSection } from './sections/mood-section';
import { SleepSection } from './sections/sleep-section';
import { FinanceSection } from './sections/finance-section';

/** Podpis okresu: „7–13 września” albo „Wrzesień 2026”. */
function periodTitle(period: Period, range: PeriodRange, today: DateKey) {
  if (period === 'week') return formatDateRange(range.from, range.to, today);
  const date = fromDateKey(range.from);
  return `${capitalize(MONTHS[date.getMonth()])} ${date.getFullYear()}`;
}

export function StatsScreen() {
  const today = useToday();
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState<DateKey>(today);
  const range = periodRange(period, anchor);
  const isCurrent = range.from <= today && today <= range.to;
  const inFuture = range.from > today;
  const sleepVisible = useModuleVisible('sen');
  const financeVisible = useModuleVisible('finanse');

  const changePeriod = (next: Period) => {
    setPeriod(next);
    setAnchor(today);
  };

  return (
    <ScrollScreen title="Statystyki">
      <View style={styles.hub}>
        <HubTile icon="lightbulb" label="Wnioski" onPress={() => router.push('/wnioski')} />
        <HubTile icon="calendar_view_month" label="Rok w pikselach" onPress={() => router.push('/rok')} />
        <HubTile icon="emoji_events" label="Osiągnięcia" onPress={() => router.push('/osiagniecia')} />
      </View>
      <View style={styles.periodChips}>
        <Chip label="Tydzień" selected={period === 'week'} onPress={() => changePeriod('week')} />
        <Chip label="Miesiąc" selected={period === 'month'} onPress={() => changePeriod('month')} />
      </View>
      <View style={styles.nav}>
        <PeriodNavigator
          title={periodTitle(period, range, today)}
          subtitle={isCurrent ? (period === 'week' ? 'Ten tydzień' : 'Ten miesiąc') : undefined}
          onPrevious={() => setAnchor(shiftPeriod(period, anchor, -1))}
          onNext={() => setAnchor(shiftPeriod(period, anchor, 1))}
          canGoNext={!isCurrent}
          unitLabel={
            period === 'week'
              ? { previous: 'Poprzedni tydzień', next: 'Następny tydzień' }
              : { previous: 'Poprzedni miesiąc', next: 'Następny miesiąc' }
          }
        />
      </View>

      {inFuture ? (
        <AppText tone="textSecondary" style={styles.center}>
          Ten okres jeszcze się nie zaczął.
        </AppText>
      ) : (
        <>
          <HabitsSection range={range} period={period} today={today} />
          <TasksSection range={range} period={period} today={today} />
          <ActivitySection range={range} period={period} today={today} />
          <MoodSection range={range} period={period} today={today} />
          {sleepVisible ? <SleepSection range={range} period={period} today={today} /> : null}
          {financeVisible ? <FinanceSection range={range} period={period} today={today} /> : null}
        </>
      )}
    </ScrollScreen>
  );
}

function HubTile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={styles.hubTile}>
      <Icon name={icon} size={22} color={colors.accent} />
      <AppText variant="caption" numberOfLines={2} style={styles.center}>
        {label}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  hub: { flexDirection: 'row', gap: spacing.sm },
  hubTile: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  periodChips: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  nav: { marginTop: -spacing.md },
  center: { textAlign: 'center' },
});
