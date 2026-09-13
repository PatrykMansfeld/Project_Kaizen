import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { HeaderActions } from '@/components/header';
import { Icon } from '@/components/icon';
import { MonthCalendar } from '@/components/month-calendar';
import { Screen } from '@/components/screen';
import { CALENDAR_DOTS_SQL, type DotKind } from '@/db/day';
import { GOALS_SQL, type Goal } from '@/db/goals';
import { useQuery } from '@/db/use-query';
import { DayAgenda } from '@/features/day/day-agenda';
import { TodayShortcuts } from '@/features/day/today-shortcuts';
import { GoalCard } from '@/features/goals/goal-card';
import { useOpenModule } from '@/features/modules/preferences';
import { XpBar } from '@/features/progress/xp-bar';
import { groupBy } from '@/lib/collections';
import { formatDayLong, monthOf, monthWeeks, relativeDayLabel, type DateKey } from '@/lib/dates';
import { capitalize } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const DOTS: { kind: DotKind; label: string }[] = [
  { kind: 'activity', label: 'Aktywność' },
  { kind: 'habits', label: 'Nawyki' },
  { kind: 'tasks', label: 'Zadania' },
  { kind: 'journal', label: 'Dziennik' },
];

export function TodayScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<DateKey>(today);
  const [month, setMonth] = useState(() => monthOf(today));

  // Kropki dla wszystkich widocznych dni siatki, łącznie z końcówkami sąsiednich miesięcy.
  const weeks = monthWeeks(month.year, month.month);
  const { rows: dotRows } = useQuery<{ date: DateKey; kind: DotKind }>(
    CALENDAR_DOTS_SQL,
    { $from: weeks[0][0], $to: weeks[weeks.length - 1][6] },
    ['workouts', 'habit_logs', 'tasks', 'journal_entries'],
  );
  const dots = new Map<DateKey, string[]>();
  for (const [date, rows] of groupBy(dotRows, (row) => row.date)) {
    const kinds = new Set(rows.map((row) => row.kind));
    dots.set(date, DOTS.filter(({ kind }) => kinds.has(kind)).map(({ kind }) => colors[kind]));
  }

  // Trwające cele (najbliższy termin najpierw).
  const { rows: goals } = useQuery<Goal>(GOALS_SQL, { $today: today }, ['goals']);
  const activeGoals = goals.filter((goal) => goal.start_date <= today && goal.end_date >= today);
  const openModule = useOpenModule();

  const todayMonth = monthOf(today);
  const showingToday = selected === today && month.year === todayMonth.year && month.month === todayMonth.month;
  const goToToday = () => {
    setSelected(today);
    setMonth(todayMonth);
  };

  const selectDay = (day: DateKey) => {
    setSelected(day);
    // Stuknięcie w dzień z sąsiedniego miesiąca przełącza siatkę.
    const dayMonth = monthOf(day);
    if (dayMonth.year !== month.year || dayMonth.month !== month.month) setMonth(dayMonth);
  };

  return (
    <Screen
      title="Dziś"
      subtitle={formatDayLong(today)}
      headerRight={
        <HeaderActions>
          {showingToday ? null : <Chip label="Dziś" icon="today" selected={false} onPress={goToToday} />}
          <IconButton icon="search" accessibilityLabel="Szukaj" onPress={() => router.push('/szukaj')} />
          <IconButton icon="apps" accessibilityLabel="Moduły" onPress={() => openModule('moduly')} />
          <IconButton icon="settings" accessibilityLabel="Ustawienia" onPress={() => router.push('/ustawienia')} />
        </HeaderActions>
      }>
      <ScrollView contentContainerStyle={styles.content}>
        <XpBar />
        <Card style={styles.calendarCard}>
          <MonthCalendar
            today={today}
            selected={selected}
            onSelect={selectDay}
            month={month}
            onMonthChange={setMonth}
            dots={dots}
          />
          <View style={styles.legend}>
            {DOTS.map(({ kind, label }) => (
              <View key={kind} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors[kind] }]} />
                <AppText variant="caption" tone="textSecondary">
                  {label}
                </AppText>
              </View>
            ))}
          </View>
        </Card>

        <TodayShortcuts today={today} />
        {activeGoals.slice(0, 2).map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            today={today}
            compact
            onPress={() => router.push({ pathname: '/cel/[id]', params: { id: String(goal.id) } })}
          />
        ))}

        <View style={styles.agendaHeader}>
          <View style={styles.flex}>
            <AppText variant="caption" tone="textSecondary">
              {relativeDayLabel(selected, today) ?? 'Wybrany dzień'}
            </AppText>
            <AppText variant="heading">{capitalize(formatDayLong(selected))}</AppText>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/dzien/[date]', params: { date: selected } })}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.openDay}>
            <AppText variant="bodyStrong" tone="accent">
              Cały dzień
            </AppText>
            <Icon name="chevron_right" size={20} color={colors.accent} />
          </Pressable>
        </View>

        <DayAgenda date={selected} today={today} variant="compact" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  calendarCard: { padding: spacing.md, borderRadius: radius.lg },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: radius.full },
  agendaHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  openDay: { flexDirection: 'row', alignItems: 'center' },
});
