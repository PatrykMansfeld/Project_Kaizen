import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { EmptyLine } from '@/components/empty-state';
import { Icon, type IconName } from '@/components/icon';
import { PeriodNavigator } from '@/components/period-navigator';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { CATEGORIES_SQL, FINANCE_TABLES, TRANSACTIONS_RANGE_SQL, type FinanceCategory, type Transaction } from '@/db/finance';
import {
  HABITS_SQL,
  HABIT_DONE_DAYS_SQL,
  HABIT_LOGS_RANGE_SQL,
  countsByHabit,
  doneDaysByHabit,
  type Habit,
  type HabitDoneDay,
  type HabitLog,
} from '@/db/habits';
import { MOODS_RANGE_SQL, type MoodRow } from '@/db/journal';
import { SLEEP_QUALITY, SLEEP_RANGE_SQL, type SleepLog } from '@/db/sleep';
import { useQuery } from '@/db/use-query';
import { WORKOUT_TYPES, WORKOUT_TYPE_KEYS, type WorkoutType } from '@/features/activity/workout-types';
import { formatMoney, summarize } from '@/features/finance/money';
import { useModuleVisible } from '@/features/modules/preferences';
import { HabitIcon } from '@/features/habits/habit-card';
import { formatStreak, formatWeeklyStreak } from '@/features/habits/streak';
import { MOODS, moodOf } from '@/features/journal/moods';
import { BarList, ColumnChart, Meter, StatRow, StatTile } from '@/features/stats/charts';
import {
  habitsSummary,
  moodStats,
  periodRange,
  shiftPeriod,
  weeklyActivity,
  type Period,
  type PeriodRange,
} from '@/features/stats/compute';
import {
  MONTHS,
  WEEKDAYS_SHORT,
  formatDateRange,
  formatDayLong,
  fromDateKey,
  toDateKey,
  weekdayIndex,
  type DateKey,
} from '@/lib/dates';
import { capitalize, formatDecimal, formatDuration, formatSigned, plural } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const MOOD_CHART_HEIGHT = 120;
const MOOD_EMOJI_SIZE = 16;

type SectionProps = { range: PeriodRange; period: Period; today: DateKey };

/** „+2 vs poprzedni tydzień” — albo nic, gdy nie ma z czym porównać. */
function versus(diff: number | null, period: Period, format: (value: number) => string) {
  if (diff === null) return undefined;
  return `${formatSigned(diff, format)} vs poprzedni ${period === 'week' ? 'tydzień' : 'miesiąc'}`;
}

/** Podpis okresu: „7–13 września” albo „Wrzesień 2026”. */
function periodTitle(period: Period, range: PeriodRange, today: DateKey) {
  if (period === 'week') return formatDateRange(range.from, range.to, today);
  const date = fromDateKey(range.from);
  return `${capitalize(MONTHS[date.getMonth()])} ${date.getFullYear()}`;
}

/** Podpis osi X wykresu dziennego: w tygodniu każdy dzień (pn…nd), w miesiącu co tydzień. */
function dayAxisLabel(period: Period, days: DateKey[], index: number) {
  if (period === 'week') return WEEKDAYS_SHORT[index];
  return [0, 7, 14, 21, days.length - 1].includes(index) ? String(Number(days[index].slice(8))) : undefined;
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

// ——— Nawyki ————————————————————————————————————————————————————————————————

function HabitsSection({ range, period, today }: SectionProps) {
  const { colors, dark } = useTheme();
  const { rows: habits } = useQuery<Habit>(HABITS_SQL, [], ['habits']);
  // Od początku poprzedniego okresu — do porównania skuteczności.
  const { rows: logs } = useQuery<HabitLog>(
    HABIT_LOGS_RANGE_SQL,
    { $from: range.prevFrom, $to: range.to },
    ['habit_logs'],
  );
  const { rows: doneRows } = useQuery<HabitDoneDay>(HABIT_DONE_DAYS_SQL, [], ['habits', 'habit_logs']);

  const counts = countsByHabit(logs);
  const doneDays = doneDaysByHabit(doneRows);
  const current = habitsSummary(habits, counts, doneDays, range.from, range.to, today);
  const previous = habitsSummary(habits, counts, doneDays, range.prevFrom, range.prevTo, today);
  const stats = current.stats;
  const diff = current.rate !== null && previous.rate !== null ? Math.round((current.rate - previous.rate) * 100) : null;
  const top = stats.reduce<(typeof stats)[number] | null>((best, stat) => (!best || stat.best > best.best ? stat : best), null);

  return (
    <Section icon="check_circle" color={colors.habits} title="Nawyki">
      {habits.length === 0 ? (
        <EmptyLine text="Brak nawyków do podsumowania." />
      ) : (
        <>
          <StatRow>
            <StatTile
              label="Skuteczność"
              value={current.rate === null ? '—' : `${Math.round(current.rate * 100)}%`}
              detail={versus(diff, period, (value) => `${value} p.p.`) ?? `${current.done} z ${current.scheduled} zaplanowanych`}
            />
            <StatTile
              label="Najlepsza seria"
              value={top && top.best > 0 ? (top.unit === 'weeks' ? formatWeeklyStreak(top.best) : formatStreak(top.best)) : '—'}
              detail={top && top.best > 0 ? `${top.habit.icon} ${top.habit.name}` : undefined}
            />
          </StatRow>
          <Card>
            {stats.map(({ habit, rate: habitRate, done, scheduled, best, unit }) => {
              const color = paletteColor(habit.color, dark);
              return (
                <View key={habit.id} style={styles.habitRow}>
                  <View style={styles.habitHeader}>
                    <HabitIcon icon={habit.icon} color={color} size={28} />
                    <AppText style={styles.flex} numberOfLines={1}>
                      {habit.name}
                    </AppText>
                    <AppText variant="bodyStrong">{habitRate === null ? '—' : `${Math.round(habitRate * 100)}%`}</AppText>
                  </View>
                  <Meter value={habitRate ?? 0} color={color} />
                  <AppText variant="caption" tone="textMuted">
                    {scheduled
                      ? `${done} z ${unit === 'weeks' ? plural(scheduled, ['tygodnia', 'tygodni', 'tygodni']) : `${scheduled} dni`}`
                      : unit === 'weeks'
                        ? 'Pierwszy tydzień jeszcze trwa'
                        : 'Brak dni do zrobienia'}
                    {best > 0
                      ? ` · najlepsza seria ${unit === 'weeks' ? `${best} tyg.` : plural(best, ['dzień', 'dni', 'dni'])}`
                      : ''}
                  </AppText>
                </View>
              );
            })}
          </Card>
        </>
      )}
    </Section>
  );
}

// ——— Zadania ———————————————————————————————————————————————————————————————

function TasksSection({ range, period, today }: SectionProps) {
  const { colors } = useTheme();
  // completed_at to czas UTC — pobieramy z zapasem i dzielimy na dni lokalnie.
  const { rows: completed } = useQuery<{ id: number; title: string; completed_at: string }>(
    'SELECT id, title, completed_at FROM tasks WHERE completed_at >= $since ORDER BY completed_at DESC',
    { $since: fromDateKey(range.prevFrom).toISOString() },
    ['tasks'],
  );
  const { rows: overdueRows } = useQuery<{ n: number }>(
    'SELECT COUNT(*) AS n FROM tasks WHERE completed_at IS NULL AND due_date < $today',
    { $today: today },
    ['tasks'],
  );

  const doneDay = (task: { completed_at: string }) => toDateKey(new Date(task.completed_at));
  const inRange = completed.filter((task) => doneDay(task) >= range.from && doneDay(task) <= range.to);
  const inPrevious = completed.filter((task) => doneDay(task) >= range.prevFrom && doneDay(task) <= range.prevTo);
  const isCurrent = range.from <= today && today <= range.to;

  return (
    <Section icon="checklist" color={colors.tasks} title="Zadania">
      <StatRow>
        <StatTile
          label="Zrobione"
          value={String(inRange.length)}
          detail={versus(inRange.length - inPrevious.length, period, String)}
        />
        {isCurrent ? (
          <StatTile label="Zaległe teraz" value={String(overdueRows[0]?.n ?? 0)} detail="otwarte po terminie" />
        ) : null}
      </StatRow>
      {period === 'week' && inRange.length > 0 ? (
        <Card>
          {inRange.slice(0, 5).map((task) => (
            <View key={task.id} style={styles.doneRow}>
              <Icon name="check" size={16} color={colors.tasks} />
              <AppText style={styles.flex} numberOfLines={1}>
                {task.title}
              </AppText>
              <AppText variant="caption" tone="textMuted">
                {WEEKDAYS_SHORT[weekdayIndex(doneDay(task))]}
              </AppText>
            </View>
          ))}
          {inRange.length > 5 ? (
            <AppText variant="caption" tone="textMuted">
              i {plural(inRange.length - 5, ['inne', 'inne', 'innych'])}
            </AppText>
          ) : null}
        </Card>
      ) : null}
    </Section>
  );
}

// ——— Aktywność —————————————————————————————————————————————————————————————

type WorkoutStatRow = { date: DateKey; type: WorkoutType; duration_min: number | null; distance_km: number | null };

function ActivitySection({ range, period }: SectionProps) {
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
                ? `${period === 'week' ? formatDayLong(selected.start) : `Tydzień od ${bucketLabel(selected.start)}`}: ${formatDuration(selected.minutes)}, ${plural(selected.count, ['trening', 'treningi', 'treningów'])}`
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

// ——— Nastrój ———————————————————————————————————————————————————————————————

function MoodSection({ range, period }: SectionProps) {
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

// ——— Sen ———————————————————————————————————————————————————————————————————

function SleepSection({ range, period }: SectionProps) {
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

// ——— Wydatki ———————————————————————————————————————————————————————————————

function FinanceSection({ range, period }: SectionProps) {
  const { colors } = useTheme();
  const { rows } = useQuery<Transaction>(TRANSACTIONS_RANGE_SQL, { $from: range.prevFrom, $to: range.to }, FINANCE_TABLES);
  const { rows: categories } = useQuery<FinanceCategory>(CATEGORIES_SQL, [], ['finance_categories']);

  const current = summarize(
    rows.filter((row) => row.date >= range.from),
    categories,
  );
  const previous = summarize(
    rows.filter((row) => row.date <= range.prevTo),
    categories,
  );
  const top = current.byCategory.filter((item) => item.amount > 0).slice(0, 5);

  return (
    <Section icon="payments" color={colors.finance} title="Wydatki">
      {current.expenses === 0 && current.income === 0 ? (
        <EmptyLine text="Brak wpisów w tym okresie. Wydatki dodasz na ekranie Dziś → Wydatki." />
      ) : (
        <>
          <StatRow>
            <StatTile
              label="Wydatki"
              value={formatMoney(current.expenses)}
              detail={previous.expenses || current.expenses ? versus(current.expenses - previous.expenses, period, formatMoney) : undefined}
            />
            <StatTile label="Bilans" value={`${current.balance > 0 ? '+' : ''}${formatMoney(current.balance)}`} detail="przychody − wydatki" />
          </StatRow>
          {top.length > 0 ? (
            <Card>
              <BarList
                items={top.map((item) => ({
                  key: String(item.category?.id ?? 'none'),
                  label: `${item.category?.icon ?? '📦'} ${item.category?.name ?? 'Bez kategorii'}`,
                  value: item.amount,
                  valueLabel: formatMoney(item.amount),
                }))}
                max={Math.max(...top.map((item) => item.amount), 1)}
                color={colors.finance}
              />
            </Card>
          ) : null}
        </>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  hub: { flexDirection: 'row', gap: spacing.sm },
  hubTile: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  periodChips: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  nav: { marginTop: -spacing.md },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  habitRow: { gap: spacing.xs },
  habitHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moodChart: { flexDirection: 'row', gap: spacing.sm },
  // Emoji skali na wysokości linii siatki 5, 3 i 1.
  moodAxis: { width: MOOD_EMOJI_SIZE + 4, height: MOOD_CHART_HEIGHT },
  moodAxisEmoji: { position: 'absolute', left: 0, fontSize: MOOD_EMOJI_SIZE - 2, lineHeight: MOOD_EMOJI_SIZE },
});
