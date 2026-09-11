import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Chip } from '@/components/chip';
import { Icon, type IconName } from '@/components/icon';
import { HABITS_SQL, HABIT_DONE_DAYS_SQL, HABIT_LOGS_RANGE_SQL, type Habit, type HabitLog } from '@/db/habits';
import { useQuery } from '@/db/use-query';
import { WORKOUT_TYPES, WORKOUT_TYPE_KEYS, type WorkoutType } from '@/features/activity/workout-types';
import { HabitIcon } from '@/features/habits/habit-card';
import { formatStreak } from '@/features/habits/streak';
import { MOODS, moodOf } from '@/features/journal/moods';
import { BarList, ColumnChart, Meter, StatRow, StatTile } from '@/features/stats/charts';
import {
  habitMonthStats,
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
import { formatDecimal, formatDuration, plural } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const MOOD_CHART_HEIGHT = 120;
const MOOD_EMOJI_SIZE = 16;

type SectionProps = { range: PeriodRange; period: Period; today: DateKey };

/** „+2 vs poprzedni tydzień” — albo nic, gdy nie ma z czym porównać. */
function versus(diff: number | null, period: Period, format: (value: number) => string) {
  if (diff === null) return undefined;
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
  return `${sign}${format(Math.abs(diff))} vs poprzedni ${period === 'week' ? 'tydzień' : 'miesiąc'}`;
}

/** Podpis okresu: „7–13 września” albo „wrzesień 2026”. */
function periodTitle(period: Period, range: PeriodRange, today: DateKey) {
  if (period === 'week') return formatDateRange(range.from, range.to, today);
  const date = fromDateKey(range.from);
  const month = MONTHS[date.getMonth()];
  return `${month[0].toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
}

export default function StatsScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState<DateKey>(today);
  const range = periodRange(period, anchor);
  const isCurrent = range.from <= today && today <= range.to;
  const inFuture = range.from > today;

  const changePeriod = (next: Period) => {
    setPeriod(next);
    setAnchor(today);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Statystyki' }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={styles.periodChips}>
          <Chip label="Tydzień" selected={period === 'week'} onPress={() => changePeriod('week')} />
          <Chip label="Miesiąc" selected={period === 'month'} onPress={() => changePeriod('month')} />
        </View>
        <View style={styles.nav}>
          <IconButton
            icon="chevron_left"
            accessibilityLabel={period === 'week' ? 'Poprzedni tydzień' : 'Poprzedni miesiąc'}
            onPress={() => setAnchor(shiftPeriod(period, anchor, -1))}
          />
          <View style={styles.navTitle}>
            <AppText variant="heading" style={styles.center}>
              {periodTitle(period, range, today)}
            </AppText>
            {isCurrent ? (
              <AppText variant="caption" tone="textSecondary">
                {period === 'week' ? 'Ten tydzień' : 'Ten miesiąc'}
              </AppText>
            ) : null}
          </View>
          <IconButton
            icon="chevron_right"
            accessibilityLabel={period === 'week' ? 'Następny tydzień' : 'Następny miesiąc'}
            color={isCurrent ? colors.border : colors.text}
            onPress={() => !isCurrent && setAnchor(shiftPeriod(period, anchor, 1))}
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
          </>
        )}
      </ScrollView>
    </>
  );
}

function Section({ icon, color, title, children }: { icon: IconName; color: string; title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name={icon} size={18} color={color} />
        <AppText variant="label" tone="textSecondary">
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface }]}>{children}</View>;
}

function Empty({ text }: { text: string }) {
  return (
    <AppText variant="caption" tone="textMuted">
      {text}
    </AppText>
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
  const { rows: doneRows } = useQuery<Pick<HabitLog, 'habit_id' | 'date'>>(HABIT_DONE_DAYS_SQL, [], [
    'habits',
    'habit_logs',
  ]);

  const statsFor = (from: DateKey, to: DateKey) =>
    habits.map((habit) => {
      const counts = new Map(logs.filter((log) => log.habit_id === habit.id).map((log) => [log.date, log.count]));
      const doneDays = new Set(doneRows.filter((row) => row.habit_id === habit.id).map((row) => row.date));
      return { habit, ...habitMonthStats(habit, counts, doneDays, from, to, today) };
    });
  const rate = (stats: ReturnType<typeof statsFor>) => {
    const scheduled = stats.reduce((sum, stat) => sum + stat.scheduled, 0);
    const done = stats.reduce((sum, stat) => sum + stat.done, 0);
    return { scheduled, done, rate: scheduled ? done / scheduled : null };
  };

  const stats = statsFor(range.from, range.to);
  const current = rate(stats);
  const previous = rate(statsFor(range.prevFrom, range.prevTo));
  const diff = current.rate !== null && previous.rate !== null ? Math.round((current.rate - previous.rate) * 100) : null;
  const top = stats.reduce<(typeof stats)[number] | null>((best, stat) => (!best || stat.best > best.best ? stat : best), null);

  return (
    <Section icon="check_circle" color={colors.habits} title="Nawyki">
      {habits.length === 0 ? (
        <Empty text="Brak nawyków do podsumowania." />
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
              value={top && top.best > 0 ? formatStreak(top.best) : '—'}
              detail={top && top.best > 0 ? `${top.habit.icon} ${top.habit.name}` : undefined}
            />
          </StatRow>
          <Card>
            {stats.map(({ habit, rate: habitRate, done, scheduled, best }) => {
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
                    {scheduled ? `${done} z ${scheduled} dni` : 'Brak dni do zrobienia'}
                    {best > 0 ? ` · najlepsza seria ${plural(best, ['dzień', 'dni', 'dni'])}` : ''}
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
        <Empty text={`Brak treningów w tym ${period === 'week' ? 'tygodniu' : 'miesiącu'}.`} />
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
  const { rows: entries } = useQuery<{ date: DateKey; mood: number }>(
    'SELECT date, mood FROM journal_entries WHERE mood IS NOT NULL AND date BETWEEN $from AND $to',
    { $from: range.prevFrom, $to: range.to },
    ['journal_entries'],
  );

  const current = entries.filter((entry) => entry.date >= range.from);
  const previous = entries.filter((entry) => entry.date <= range.prevTo);
  const byDay = new Map(current.map((entry) => [entry.date, entry.mood]));
  const { counts, average } = moodStats(current.map((entry) => entry.mood));
  const previousAverage = moodStats(previous.map((entry) => entry.mood)).average;
  const days = range.days;
  // Tydzień: podpis przy każdym dniu (pn…nd). Miesiąc: co tydzień — nie przy każdym dniu.
  const labeled = new Set(period === 'week' ? days.map((_, index) => index) : [0, 7, 14, 21, days.length - 1]);
  const selectedMood = selected ? moodOf(byDay.get(selected) ?? null) : null;

  return (
    <Section icon="mood" color={colors.journal} title="Nastrój">
      {current.length === 0 ? (
        <Empty text={`Brak ocen nastroju w tym ${period === 'week' ? 'tygodniu' : 'miesiącu'}. Dodasz je w dzienniku.`} />
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
                      axisLabel: labeled.has(index)
                        ? period === 'week'
                          ? WEEKDAYS_SHORT[index]
                          : String(Number(day.slice(8)))
                        : undefined,
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
  content: { gap: spacing.xl, padding: spacing.lg },
  periodChips: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  nav: { flexDirection: 'row', alignItems: 'center', marginTop: -spacing.md },
  navTitle: { flex: 1, alignItems: 'center' },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.md },
  habitRow: { gap: spacing.xs },
  habitHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moodChart: { flexDirection: 'row', gap: spacing.sm },
  // Emoji skali na wysokości linii siatki 5, 3 i 1.
  moodAxis: { width: MOOD_EMOJI_SIZE + 4, height: MOOD_CHART_HEIGHT },
  moodAxisEmoji: { position: 'absolute', left: 0, fontSize: MOOD_EMOJI_SIZE - 2, lineHeight: MOOD_EMOJI_SIZE },
});
