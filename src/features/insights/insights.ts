import type { IconName } from '@/components/icon';
import type { Habit } from '@/db/habits';
import { habitStartDay, isScheduled } from '@/features/habits/streak';
import { addDays, weekdayIndex, type DateKey } from '@/lib/dates';
import { FORMS, formatDecimal, formatDuration, plural } from '@/lib/format';

/** „w poniedziałki”, „we wtorki”… — do zdań o powtarzających się dniach. */
const ON_WEEKDAYS = ['w poniedziałki', 'we wtorki', 'w środy', 'w czwartki', 'w piątki', 'w soboty', 'w niedziele'];
/** Noc przypisana do dnia pobudki: „przed poniedziałkiem”… */
const BEFORE_WEEKDAY = [
  'przed poniedziałkiem',
  'przed wtorkiem',
  'przed środą',
  'przed czwartkiem',
  'przed piątkiem',
  'przed sobotą',
  'przed niedzielą',
];

/** Minimalna liczba dni w każdej porównywanej grupie — mniej to przypadek, nie wniosek. */
const MIN_SAMPLES = 3;
/** Różnica nastroju (w skali 1–5), poniżej której mówimy „bez wyraźnej różnicy”. */
const MOOD_EPSILON = 0.2;
/** Granica „wyspanej” nocy. */
const GOOD_SLEEP_MIN = 7 * 60;

export type InsightModule = 'activity' | 'habits' | 'tasks' | 'journal' | 'sleep';

export type Insight = {
  key: string;
  module: InsightModule;
  icon: IconName;
  title: string;
  detail: string;
  /** Porównanie dwóch grup (poziome słupki). */
  compare?: { max: number; items: { key: string; label: string; value: number; valueLabel: string }[] };
  /** Wartość dla każdego dnia tygodnia (pn–nd); `highlight` — indeks wyróżnionego dnia. */
  weekdays?: { values: (number | null)[]; max: number; highlight: number; format: (value: number) => string };
};

export type InsightData = {
  /** Dni analizowanego okresu, bez przyszłości. */
  days: DateKey[];
  today: DateKey;
  moods: Map<DateKey, number>;
  workouts: { date: DateKey; duration_min: number | null }[];
  sleep: { date: DateKey; duration_min: number; quality: number | null }[];
  habits: Pick<Habit, 'id' | 'name' | 'icon' | 'days_mask' | 'weekly_target' | 'created_at'>[];
  /** Dni z osiągniętym celem, per nawyk. */
  doneDays: Map<number, Set<DateKey>>;
  /** Lokalne dni ukończenia zadań. */
  tasksDone: DateKey[];
};

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

const mood = (value: number) => formatDecimal(value, 1);

/** Średni nastrój w dwóch grupach dni albo null, gdy którejś grupie brakuje danych. */
function compareMood(moods: Map<DateKey, number>, inGroup: (day: DateKey) => boolean | null) {
  const yes: number[] = [];
  const no: number[] = [];
  for (const [day, value] of moods) {
    const group = inGroup(day);
    if (group === null) continue;
    (group ? yes : no).push(value);
  }
  if (yes.length < MIN_SAMPLES || no.length < MIN_SAMPLES) return null;
  const a = mean(yes)!;
  const b = mean(no)!;
  return { a, b, diff: a - b, countA: yes.length, countB: no.length };
}

function moodCompare(labels: [string, string], result: { a: number; b: number }) {
  return {
    max: 5,
    items: [
      { key: 'a', label: labels[0], value: result.a, valueLabel: mood(result.a) },
      { key: 'b', label: labels[1], value: result.b, valueLabel: mood(result.b) },
    ],
  };
}

/** Średnia wartości per dzień tygodnia (null, gdy dzień ma mniej niż `minSamples` pomiarów). */
function byWeekday(entries: [DateKey, number][], minSamples: number, aggregate: 'mean' | 'sum' = 'mean') {
  const buckets: number[][] = [[], [], [], [], [], [], []];
  for (const [day, value] of entries) buckets[weekdayIndex(day)].push(value);
  return buckets.map((values) => {
    if (aggregate === 'sum') return values.reduce((sum, value) => sum + value, 0);
    return values.length >= minSamples ? mean(values) : null;
  });
}

function extremes(values: (number | null)[]) {
  let best = -1;
  let worst = -1;
  values.forEach((value, index) => {
    if (value === null) return;
    if (best < 0 || value > values[best]!) best = index;
    if (worst < 0 || value < values[worst]!) worst = index;
  });
  return best < 0 ? null : { best, worst };
}

/** Wszystkie wnioski, na które starcza danych — w stałej kolejności. */
export function computeInsights(data: InsightData): Insight[] {
  const insights: Insight[] = [];
  const inRange = new Set(data.days);
  const workoutDays = new Set(data.workouts.map((workout) => workout.date));
  const sleepByDay = new Map(data.sleep.map((night) => [night.date, night]));

  // — Nastrój a trening —
  const workoutMood = compareMood(data.moods, (day) => workoutDays.has(day));
  if (workoutMood) {
    const { diff } = workoutMood;
    insights.push({
      key: 'mood-workout',
      module: 'activity',
      icon: 'fitness_center',
      title:
        diff >= MOOD_EPSILON
          ? 'W dni z treningiem masz lepszy nastrój'
          : diff <= -MOOD_EPSILON
            ? 'W dni z treningiem nastrój bywa słabszy'
            : 'Trening nie zmienia wyraźnie nastroju',
      detail: `Średnio ${mood(workoutMood.a)} vs ${mood(workoutMood.b)} w dni bez treningu (${plural(workoutMood.countA, FORMS.day)} i ${plural(workoutMood.countB, FORMS.day)} z oceną nastroju).`,
      compare: moodCompare(['Z treningiem', 'Bez treningu'], workoutMood),
    });
  }

  // — Nastrój a sen —
  const sleepMood = compareMood(data.moods, (day) => {
    const night = sleepByDay.get(day);
    return night ? night.duration_min >= GOOD_SLEEP_MIN : null;
  });
  if (sleepMood) {
    const { diff } = sleepMood;
    insights.push({
      key: 'mood-sleep',
      module: 'sleep',
      icon: 'bedtime',
      title:
        diff >= MOOD_EPSILON
          ? 'Po przespanych 7 h nastrój jest lepszy'
          : diff <= -MOOD_EPSILON
            ? 'Po krótszych nocach nastrój bywa lepszy'
            : 'Długość snu nie zmienia wyraźnie nastroju',
      detail: `Średnio ${mood(sleepMood.a)} po nocach od 7 h vs ${mood(sleepMood.b)} po krótszych.`,
      compare: moodCompare(['Sen ≥ 7 h', 'Sen < 7 h'], sleepMood),
    });
  }

  // — Sen po treningu (noc zapisana pod dniem pobudki, czyli dzień po treningu) —
  const afterWorkout: number[] = [];
  const afterRest: number[] = [];
  for (const night of data.sleep) {
    const previous = addDays(night.date, -1);
    if (!inRange.has(previous)) continue;
    (workoutDays.has(previous) ? afterWorkout : afterRest).push(night.duration_min);
  }
  if (afterWorkout.length >= MIN_SAMPLES && afterRest.length >= MIN_SAMPLES) {
    const a = mean(afterWorkout)!;
    const b = mean(afterRest)!;
    const diff = Math.round(a - b);
    insights.push({
      key: 'sleep-workout',
      module: 'sleep',
      icon: 'hotel',
      title:
        diff >= 10
          ? `Po dniu z treningiem śpisz dłużej o ${formatDuration(diff)}`
          : diff <= -10
            ? `Po dniu z treningiem śpisz krócej o ${formatDuration(-diff)}`
            : 'Trening nie zmienia wyraźnie długości snu',
      detail: `Średnio ${formatDuration(Math.round(a))} po treningu vs ${formatDuration(Math.round(b))} po dniu bez treningu.`,
      compare: {
        max: Math.max(a, b),
        items: [
          { key: 'a', label: 'Po treningu', value: a, valueLabel: formatDuration(Math.round(a)) },
          { key: 'b', label: 'Bez treningu', value: b, valueLabel: formatDuration(Math.round(b)) },
        ],
      },
    });
  }

  // — Nawyk, z którym nastrój jest najwyższy —
  const habitDays = (habit: InsightData['habits'][number]) => {
    const done = data.doneDays.get(habit.id) ?? new Set<DateKey>();
    const start = habitStartDay(habit.created_at, done);
    return { done, start };
  };
  let bestHabit: { habit: InsightData['habits'][number]; a: number; b: number; diff: number } | null = null;
  for (const habit of data.habits) {
    if (habit.weekly_target) continue;
    const { done, start } = habitDays(habit);
    const result = compareMood(data.moods, (day) => {
      if (day < start || !isScheduled(habit.days_mask, day)) return null;
      if (day === data.today && !done.has(day)) return null;
      return done.has(day);
    });
    if (result && result.diff >= 0.3 && (!bestHabit || result.diff > bestHabit.diff)) bestHabit = { habit, ...result };
  }
  if (bestHabit) {
    const { habit } = bestHabit;
    insights.push({
      key: 'mood-habit',
      module: 'habits',
      icon: 'favorite',
      title: `Z nawykiem ${habit.icon} ${habit.name} masz lepszy nastrój`,
      detail: `Średnio ${mood(bestHabit.a)} w dni, gdy go zrobisz, vs ${mood(bestHabit.b)}, gdy odpuścisz.`,
      compare: moodCompare(['Zrobiony', 'Odpuszczony'], bestHabit),
    });
  }

  // — Nawyki a dzień tygodnia —
  const habitEntries: [DateKey, number][] = [];
  for (const habit of data.habits) {
    if (habit.weekly_target) continue;
    const { done, start } = habitDays(habit);
    for (const day of data.days) {
      if (day < start || day >= data.today || !isScheduled(habit.days_mask, day)) continue;
      habitEntries.push([day, done.has(day) ? 1 : 0]);
    }
  }
  if (habitEntries.length >= 14) {
    const values = byWeekday(habitEntries, 2);
    const ends = extremes(values);
    if (ends && ends.best !== ends.worst) {
      const spread = values[ends.best]! - values[ends.worst]!;
      const percent = (value: number) => `${Math.round(value * 100)}%`;
      insights.push({
        key: 'habits-weekday',
        module: 'habits',
        icon: 'event_busy',
        title:
          spread >= 0.1
            ? `Najczęściej odpuszczasz nawyki ${ON_WEEKDAYS[ends.worst]}`
            : 'Nawyki idą równo przez cały tydzień',
        detail: `Skuteczność ${ON_WEEKDAYS[ends.worst]} ${percent(values[ends.worst]!)}, najlepiej ${ON_WEEKDAYS[ends.best]} (${percent(values[ends.best]!)}).`,
        weekdays: { values, max: 1, highlight: ends.worst, format: percent },
      });
    }
  }

  // — Nastrój a dzień tygodnia —
  if (data.moods.size >= 14) {
    const values = byWeekday([...data.moods], 2);
    const ends = extremes(values);
    if (ends && ends.best !== ends.worst) {
      insights.push({
        key: 'mood-weekday',
        module: 'journal',
        icon: 'sentiment_satisfied',
        title: `Najlepszy nastrój masz ${ON_WEEKDAYS[ends.best]}`,
        detail: `Średnio ${mood(values[ends.best]!)}, najsłabiej ${ON_WEEKDAYS[ends.worst]} (${mood(values[ends.worst]!)}).`,
        weekdays: { values, max: 5, highlight: ends.best, format: mood },
      });
    }
  }

  // — Sen a dzień tygodnia —
  if (data.sleep.length >= 14) {
    const values = byWeekday(
      data.sleep.map((night) => [night.date, night.duration_min]),
      2,
    );
    const ends = extremes(values);
    if (ends && ends.best !== ends.worst) {
      const hours = (value: number) => formatDuration(Math.round(value));
      insights.push({
        key: 'sleep-weekday',
        module: 'sleep',
        icon: 'nights_stay',
        title: `Najkrócej śpisz ${BEFORE_WEEKDAY[ends.worst]}`,
        detail: `Średnio ${hours(values[ends.worst]!)}, najdłużej ${BEFORE_WEEKDAY[ends.best]} (${hours(values[ends.best]!)}).`,
        weekdays: { values, max: values[ends.best]!, highlight: ends.worst, format: hours },
      });
    }
  }

  // — Treningi a dzień tygodnia —
  if (data.workouts.length >= 6) {
    const values = byWeekday(
      data.workouts.map((workout) => [workout.date, 1]),
      1,
      'sum',
    );
    const ends = extremes(values)!;
    insights.push({
      key: 'workouts-weekday',
      module: 'activity',
      icon: 'directions_run',
      title: `Najczęściej trenujesz ${ON_WEEKDAYS[ends.best]}`,
      detail: `${plural(values[ends.best]!, FORMS.workout)} z ${data.workouts.length} w tym okresie.`,
      weekdays: { values, max: values[ends.best]!, highlight: ends.best, format: (value) => String(value) },
    });
  }

  // — Zadania a dzień tygodnia —
  if (data.tasksDone.length >= 10) {
    const values = byWeekday(
      data.tasksDone.map((day) => [day, 1]),
      1,
      'sum',
    );
    const ends = extremes(values)!;
    insights.push({
      key: 'tasks-weekday',
      module: 'tasks',
      icon: 'task_alt',
      title: `Najwięcej zadań kończysz ${ON_WEEKDAYS[ends.best]}`,
      detail: `${plural(values[ends.best]!, FORMS.task)} z ${data.tasksDone.length} ukończonych w tym okresie.`,
      weekdays: { values, max: values[ends.best]!, highlight: ends.best, format: (value) => String(value) },
    });
  }

  return insights;
}
