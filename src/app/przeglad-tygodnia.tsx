import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { PeriodNavigator } from '@/components/period-navigator';
import { ScrollScreen } from '@/components/screen';
import { TextField } from '@/components/text-field';
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
import { createQuickTask } from '@/db/tasks';
import { useQuery } from '@/db/use-query';
import { getWeeklyReview, parsePriorities, saveWeeklyReview, type WeeklyReviewContent } from '@/db/weekly-reviews';
import { moodOf } from '@/features/journal/moods';
import { StatRow, StatTile } from '@/features/stats/charts';
import { habitsSummary } from '@/features/stats/compute';
import {
  addDays,
  formatDateRange,
  formatDayShort,
  fromDateKey,
  isDateKey,
  startOfWeek,
  weekdayIndex,
  type DateKey,
} from '@/lib/dates';
import { formatDecimal, formatDuration, plural } from '@/lib/format';
import { useAutosave } from '@/lib/use-autosave';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';

/** Domyślnie: od piątku bieżący tydzień, wcześniej — poprzedni (który już się skończył). */
function defaultWeek(today: DateKey) {
  const monday = startOfWeek(today);
  return weekdayIndex(today) >= 4 ? monday : addDays(monday, -7);
}

/** Przegląd tygodnia: /przeglad-tygodnia (opcjonalnie ?week=poniedziałek). */
export default function WeeklyReviewScreen() {
  const params = useLocalSearchParams<{ week?: string }>();
  const today = useToday();
  const [weekStart, setWeekStart] = useState<DateKey>(
    isDateKey(params.week) ? startOfWeek(params.week) : defaultWeek(today),
  );
  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = weekStart === startOfWeek(today);

  return (
    <ScrollScreen title="Przegląd tygodnia">
      <PeriodNavigator
        title={formatDateRange(weekStart, weekEnd, today)}
        subtitle={isCurrentWeek ? 'Ten tydzień' : undefined}
        onPrevious={() => setWeekStart(addDays(weekStart, -7))}
        onNext={() => setWeekStart(addDays(weekStart, 7))}
        canGoNext={!isCurrentWeek}
        unitLabel={{ previous: 'Poprzedni tydzień', next: 'Następny tydzień' }}
      />
      {/* key: zmiana tygodnia montuje formularz od nowa (odmontowanie zapisuje poprzedni). */}
      <WeekSummary key={`s${weekStart}`} from={weekStart} to={weekEnd} today={today} />
      <ReviewForm key={weekStart} weekStart={weekStart} />
    </ScrollScreen>
  );
}

function WeekSummary({ from, to, today }: { from: DateKey; to: DateKey; today: DateKey }) {
  const { rows: habits } = useQuery<Habit>(HABITS_SQL, [], ['habits']);
  const { rows: logs } = useQuery<HabitLog>(HABIT_LOGS_RANGE_SQL, { $from: from, $to: to }, ['habit_logs']);
  const { rows: doneRows } = useQuery<HabitDoneDay>(HABIT_DONE_DAYS_SQL, [], ['habits', 'habit_logs']);
  const { rows: totals } = useQuery<{ workouts: number; minutes: number; tasks: number; mood: number | null; sleep: number | null }>(
    `SELECT
       (SELECT COUNT(*) FROM workouts WHERE date BETWEEN $from AND $to) AS workouts,
       (SELECT COALESCE(SUM(duration_min), 0) FROM workouts WHERE date BETWEEN $from AND $to) AS minutes,
       (SELECT COUNT(*) FROM tasks WHERE completed_at >= $fromIso AND completed_at < $toIso) AS tasks,
       (SELECT AVG(mood) FROM journal_entries WHERE date BETWEEN $from AND $to) AS mood,
       (SELECT AVG(duration_min) FROM sleep_logs WHERE date BETWEEN $from AND $to) AS sleep`,
    { $from: from, $to: to, $fromIso: fromDateKey(from).toISOString(), $toIso: fromDateKey(addDays(to, 1)).toISOString() },
    ['workouts', 'tasks', 'journal_entries', 'sleep_logs'],
  );

  // Nawyki tygodniowe liczą się jako 1 „zadanie” na tydzień — tak jak w statystykach.
  const { scheduled, done } = habitsSummary(habits, countsByHabit(logs), doneDaysByHabit(doneRows), from, to, today);
  const t = totals[0];
  const mood = t?.mood ? moodOf(Math.round(t.mood)) : null;

  return (
    <View style={styles.summary}>
      <StatRow>
        <StatTile label="Nawyki" value={scheduled ? `${Math.round((done / scheduled) * 100)}%` : '—'} detail={scheduled ? `${done} z ${scheduled}` : undefined} />
        <StatTile label="Zadania" value={String(t?.tasks ?? 0)} detail="zrobione" />
      </StatRow>
      <StatRow>
        <StatTile label="Treningi" value={String(t?.workouts ?? 0)} detail={t?.minutes ? formatDuration(t.minutes) : undefined} />
        <StatTile label="Nastrój" value={t?.mood ? `${mood?.emoji ?? ''} ${formatDecimal(t.mood, 1)}` : '—'} />
        <StatTile label="Sen" value={t?.sleep ? formatDuration(Math.round(t.sleep)) : '—'} detail={t?.sleep ? 'średnio' : undefined} />
      </StatRow>
    </View>
  );
}

function ReviewForm({ weekStart }: { weekStart: DateKey }) {
  const db = useSQLiteContext();
  const [content, setContent] = useState<WeeklyReviewContent>({ went_well: '', improve: '', priorities: '' });
  const [loaded, setLoaded] = useState(false);
  const { schedule, flush } = useAutosave<WeeklyReviewContent>(async (value) => {
    await saveWeeklyReview(db, weekStart, value);
  });

  useEffect(() => {
    getWeeklyReview(db, weekStart).then((review) => {
      if (review) setContent({ went_well: review.went_well, improve: review.improve, priorities: review.priorities });
      setLoaded(true);
    });
  }, [db, weekStart]);

  if (!loaded) return null;

  const change = (patch: Partial<WeeklyReviewContent>) => {
    const next = { ...content, ...patch };
    setContent(next);
    schedule(next);
  };

  const priorities = parsePriorities(content.priorities);
  const nextMonday = addDays(weekStart, 7);

  const addAsTasks = () =>
    Alert.alert(
      'Dodać jako zadania?',
      `${plural(priorities.length, ['zadanie', 'zadania', 'zadań'])} z terminem na poniedziałek, ${formatDayShort(nextMonday)}.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Dodaj',
          onPress: async () => {
            await flush();
            for (const title of priorities) await createQuickTask(db, title, nextMonday, 2);
            Alert.alert('Gotowe', 'Priorytety czekają w zakładce Zadania.');
          },
        },
      ],
    );

  return (
    <View style={styles.form}>
      <TextField
        label="Co poszło dobrze?"
        value={content.went_well}
        onChangeText={(went_well) => change({ went_well })}
        placeholder="Sukcesy, małe wygrane, dobre decyzje…"
        multiline
      />
      <TextField
        label="Co chcę poprawić?"
        value={content.improve}
        onChangeText={(improve) => change({ improve })}
        placeholder="Co nie wyszło i co zmienię w przyszłym tygodniu?"
        multiline
      />
      <TextField
        label="Priorytety na kolejny tydzień"
        value={content.priorities}
        onChangeText={(value) => change({ priorities: value })}
        placeholder={'Po jednym w linii, np.\nSkończyć raport\n3 treningi\nZadzwonić do rodziców'}
        multiline
      />
      {priorities.length > 0 ? (
        <Button label={`Dodaj priorytety jako zadania (${priorities.length})`} icon="playlist_add" variant="secondary" onPress={addAsTasks} />
      ) : null}
      <AppText variant="caption" tone="textMuted">
        Przegląd zapisuje się automatycznie.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.sm },
  form: { gap: spacing.lg },
});
