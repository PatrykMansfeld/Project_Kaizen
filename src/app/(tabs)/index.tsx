import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { MonthCalendar } from '@/components/month-calendar';
import { Screen } from '@/components/screen';
import { CALENDAR_DOTS_SQL, type DotKind } from '@/db/day';
import { GOALS_SQL, type Goal } from '@/db/goals';
import { SETTING_SQL } from '@/db/settings';
import { useQuery } from '@/db/use-query';
import { DayAgenda } from '@/features/day/day-agenda';
import { GoalCard } from '@/features/goals/goal-card';
import { formatDayLong, monthOf, monthWeeks, relativeDayLabel, type DateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const DOTS: { kind: DotKind; label: string }[] = [
  { kind: 'activity', label: 'Aktywność' },
  { kind: 'habits', label: 'Nawyki' },
  { kind: 'tasks', label: 'Zadania' },
  { kind: 'journal', label: 'Dziennik' },
];

export default function TodayScreen() {
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
  const kindsByDay = new Map<DateKey, Set<DotKind>>();
  for (const { date, kind } of dotRows) {
    if (!kindsByDay.has(date)) kindsByDay.set(date, new Set());
    kindsByDay.get(date)!.add(kind);
  }
  const dots = new Map<DateKey, string[]>();
  for (const [date, kinds] of kindsByDay) {
    dots.set(
      date,
      DOTS.filter(({ kind }) => kinds.has(kind)).map(({ kind }) => colors[kind]),
    );
  }

  // Trwające cele (najbliższy termin najpierw) i czy dzisiejszy dzień jest już podsumowany.
  const { rows: goals } = useQuery<Goal>(GOALS_SQL, { $today: today }, ['goals']);
  const activeGoals = goals.filter((goal) => goal.start_date <= today && goal.end_date >= today);
  const { rows: reviewRows } = useQuery<{ value: string }>(SETTING_SQL, { $key: 'last_review_date' }, ['settings']);
  const reviewedToday = reviewRows[0]?.value === today;

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

  const selectedLabel = formatDayLong(selected);

  return (
    <Screen
      title="Dziś"
      subtitle={formatDayLong(today)}
      headerRight={
        <View style={styles.headerActions}>
          {showingToday ? null : <Chip label="Dziś" icon="today" selected={false} onPress={goToToday} />}
          <IconButton icon="search" accessibilityLabel="Szukaj" onPress={() => router.push('/szukaj')} />
          <IconButton icon="insights" accessibilityLabel="Statystyki" onPress={() => router.push('/statystyki')} />
          <IconButton icon="settings" accessibilityLabel="Ustawienia" onPress={() => router.push('/ustawienia')} />
        </View>
      }>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.calendarCard, { backgroundColor: colors.surface }]}>
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
        </View>

        <View style={styles.quickActions}>
          <Chip label="Cele" icon="sports_score" selected={false} onPress={() => router.push('/cele')} />
          <Chip
            label={reviewedToday ? 'Dzień podsumowany' : 'Podsumuj dzień'}
            icon={reviewedToday ? 'done_all' : 'bedtime'}
            selected={reviewedToday}
            onPress={() => router.push('/podsumowanie')}
          />
        </View>
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
            <AppText variant="heading">{selectedLabel[0].toUpperCase() + selectedLabel.slice(1)}</AppText>
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
  calendarCard: { gap: spacing.md, padding: spacing.md, borderRadius: radius.lg },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: radius.full },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  agendaHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  openDay: { flexDirection: 'row', alignItems: 'center' },
});
