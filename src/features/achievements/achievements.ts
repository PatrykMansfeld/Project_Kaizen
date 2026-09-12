import type { SQLiteDatabase } from 'expo-sqlite';

import { goalFraction, goalProgressQuery, type Goal } from '@/db/goals';
import { ALL_HABIT_DONE_DAYS_SQL, doneDaysByHabit, type Habit, type HabitDoneDay } from '@/db/habits';
import { getSetting } from '@/db/settings';
import { bestStreak, habitStartDay } from '@/features/habits/streak';
import { addDays, type DateKey } from '@/lib/dates';

/** Liczniki, z których wynikają odznaki. */
export type AchievementStats = {
  /** Najdłuższa seria dni (nawyki codzienne / w wybrane dni). */
  habitStreak: number;
  /** Ile razy łącznie osiągnięto dzienny cel nawyku. */
  habitDone: number;
  workouts: number;
  distanceKm: number;
  /** Ile razy pobito własny rekord ciężaru w ćwiczeniu (pierwszy trening ćwiczenia się nie liczy). */
  records: number;
  tasksDone: number;
  journalEntries: number;
  /** Najdłuższa seria kolejnych dni z wpisem w dzienniku. */
  journalStreak: number;
  dailyReviews: number;
  weeklyReviews: number;
  sleepLogs: number;
  goalsAchieved: number;
  notes: number;
};

type Group = {
  key: keyof AchievementStats;
  category: string;
  icon: string;
  tiers: number[];
  title: (tier: number) => string;
  description: (tier: number) => string;
};

/** Kategorie odznak — każdy próg to osobna odznaka. Nowe progi dopisuj na końcu listy, id się nie zmienią. */
const GROUPS: Group[] = [
  {
    key: 'habitStreak',
    category: 'Nawyki',
    icon: '🔥',
    tiers: [7, 30, 100, 365],
    title: (tier) => `Seria ${tier} dni`,
    description: (tier) => `Rób nawyk ${tier} zaplanowanych dni z rzędu.`,
  },
  {
    key: 'habitDone',
    category: 'Nawyki',
    icon: '✅',
    tiers: [50, 250, 1000],
    title: (tier) => `${tier} odhaczeń`,
    description: (tier) => `Osiągnij dzienny cel nawyków łącznie ${tier} razy.`,
  },
  {
    key: 'workouts',
    category: 'Aktywność',
    icon: '💪',
    tiers: [1, 10, 50, 100, 250],
    title: (tier) => (tier === 1 ? 'Pierwszy trening' : `${tier} treningów`),
    description: (tier) => (tier === 1 ? 'Zapisz swój pierwszy trening.' : `Zapisz łącznie ${tier} treningów.`),
  },
  {
    key: 'distanceKm',
    category: 'Aktywność',
    icon: '🏃',
    tiers: [10, 100, 500, 1000],
    title: (tier) => `${tier} km`,
    description: (tier) => `Pokonaj łącznie ${tier} km na spacerach, biegach, rowerze i basenie.`,
  },
  {
    key: 'records',
    category: 'Aktywność',
    icon: '🏆',
    tiers: [1, 10, 50],
    title: (tier) => (tier === 1 ? 'Pierwszy rekord' : `${tier} rekordów`),
    description: (tier) =>
      tier === 1 ? 'Pobij swój rekord ciężaru w dowolnym ćwiczeniu.' : `Pobij rekord ciężaru ${tier} razy.`,
  },
  {
    key: 'tasksDone',
    category: 'Zadania',
    icon: '☑️',
    tiers: [10, 100, 500, 1000],
    title: (tier) => `${tier} zadań`,
    description: (tier) => `Ukończ łącznie ${tier} zadań.`,
  },
  {
    key: 'goalsAchieved',
    category: 'Cele',
    icon: '🎯',
    tiers: [1, 5, 10],
    title: (tier) => (tier === 1 ? 'Pierwszy cel' : `${tier} celów`),
    description: (tier) => (tier === 1 ? 'Osiągnij swój pierwszy cel długoterminowy.' : `Osiągnij ${tier} celów.`),
  },
  {
    key: 'journalEntries',
    category: 'Dziennik',
    icon: '📔',
    tiers: [7, 30, 100, 365],
    title: (tier) => `${tier} wpisów`,
    description: (tier) => `Napisz albo oceń nastrój w dzienniku ${tier} razy.`,
  },
  {
    key: 'journalStreak',
    category: 'Dziennik',
    icon: '✍️',
    tiers: [7, 30],
    title: (tier) => `Dziennik ${tier} dni z rzędu`,
    description: (tier) => `Zapisuj dziennik codziennie przez ${tier} dni.`,
  },
  {
    key: 'dailyReviews',
    category: 'Refleksja',
    icon: '🌙',
    tiers: [7, 30, 100],
    title: (tier) => `${tier} podsumowań dnia`,
    description: (tier) => `Domknij dzień w „Podsumuj dzień” ${tier} razy.`,
  },
  {
    key: 'weeklyReviews',
    category: 'Refleksja',
    icon: '🗓️',
    tiers: [4, 12, 52],
    title: (tier) => `${tier} przeglądów tygodnia`,
    description: (tier) => `Zrób przegląd tygodnia ${tier} razy.`,
  },
  {
    key: 'sleepLogs',
    category: 'Sen',
    icon: '😴',
    tiers: [7, 30, 100],
    title: (tier) => `${tier} nocy`,
    description: (tier) => `Zapisz sen ${tier} razy.`,
  },
  {
    key: 'notes',
    category: 'Notatki',
    icon: '📝',
    tiers: [10, 50],
    title: (tier) => `${tier} notatek`,
    description: (tier) => `Utwórz ${tier} notatek.`,
  },
];

export type Achievement = {
  /** Stałe id, np. 'workouts:10' — zapisywane w 'achievements_seen'. */
  id: string;
  category: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  /** Postęp do progu: min(wartość, próg). */
  progress: number;
  target: number;
};

export function achievementList(stats: AchievementStats): Achievement[] {
  return GROUPS.flatMap((group) =>
    group.tiers.map((tier) => {
      const value = stats[group.key];
      return {
        id: `${group.key}:${tier}`,
        category: group.category,
        icon: group.icon,
        title: group.title(tier),
        description: group.description(tier),
        unlocked: value >= tier,
        progress: Math.min(value, tier),
        target: tier,
      };
    }),
  );
}

/** Najdłuższy ciąg kolejnych dni w posortowanej rosnąco liście. */
export function longestRun(days: DateKey[]) {
  let best = 0;
  let run = 0;
  let previous: DateKey | null = null;
  for (const day of days) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** Ile razy sesja ćwiczenia przebiła najlepszy wcześniejszy ciężar (wiersze posortowane po ćwiczeniu i dacie). */
export function countRecords(rows: { exercise_id: number; max_weight: number }[]) {
  let records = 0;
  let exercise: number | null = null;
  let best = 0;
  for (const row of rows) {
    if (row.exercise_id !== exercise) {
      exercise = row.exercise_id;
      best = row.max_weight;
      continue;
    }
    if (row.max_weight > best) {
      records++;
      best = row.max_weight;
    }
  }
  return records;
}

/** Zbiera liczniki z bazy (kilka zapytań agregujących). */
export async function loadAchievementStats(db: SQLiteDatabase, today: DateKey): Promise<AchievementStats> {
  const totals = await db.getFirstAsync<{
    habit_done: number;
    workouts: number;
    distance: number;
    tasks: number;
    journal: number;
    weekly: number;
    sleep: number;
    notes: number;
  }>(`SELECT
      (SELECT COUNT(*) FROM habit_logs l JOIN habits h ON h.id = l.habit_id WHERE l.count >= h.target_per_day) AS habit_done,
      (SELECT COUNT(*) FROM workouts) AS workouts,
      (SELECT COALESCE(SUM(distance_km), 0) FROM workouts) AS distance,
      (SELECT COUNT(*) FROM tasks WHERE completed_at IS NOT NULL) AS tasks,
      (SELECT COUNT(*) FROM journal_entries WHERE mood IS NOT NULL OR TRIM(body) <> '') AS journal,
      (SELECT COUNT(*) FROM weekly_reviews) AS weekly,
      (SELECT COUNT(*) FROM sleep_logs) AS sleep,
      (SELECT COUNT(*) FROM notes) AS notes`);

  // Serie nawyków — także zarchiwizowanych (odznaka raz zdobyta nie znika).
  const habits = await db.getAllAsync<Pick<Habit, 'id' | 'days_mask' | 'weekly_target' | 'created_at'>>(
    'SELECT id, days_mask, weekly_target, created_at FROM habits',
  );
  const doneByHabit = doneDaysByHabit(await db.getAllAsync<HabitDoneDay>(ALL_HABIT_DONE_DAYS_SQL));
  let habitStreak = 0;
  for (const habit of habits) {
    const done = doneByHabit.get(habit.id);
    if (habit.weekly_target || !done) continue;
    habitStreak = Math.max(habitStreak, bestStreak(done, today, habit.days_mask, habitStartDay(habit.created_at, done)));
  }

  const journalDays = await db.getAllAsync<{ date: DateKey }>(
    "SELECT date FROM journal_entries WHERE mood IS NOT NULL OR TRIM(body) <> '' ORDER BY date",
  );

  const sessions = await db.getAllAsync<{ exercise_id: number; max_weight: number }>(
    `SELECT s.exercise_id, MAX(s.weight_kg) AS max_weight
     FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
     WHERE s.weight_kg > 0
     GROUP BY s.exercise_id, s.workout_id
     ORDER BY s.exercise_id, w.date, w.id`,
  );

  const goals = await db.getAllAsync<Goal>('SELECT * FROM goals');
  let goalsAchieved = 0;
  for (const goal of goals) {
    const query = goalProgressQuery(goal);
    const row = await db.getFirstAsync<{ value: number | null }>(query.sql, query.params);
    const value = row?.value ?? (goal.kind === 'measurement' ? null : 0);
    if (goalFraction(goal, value) >= 1) goalsAchieved++;
  }

  return {
    habitStreak,
    habitDone: totals?.habit_done ?? 0,
    workouts: totals?.workouts ?? 0,
    distanceKm: totals?.distance ?? 0,
    records: countRecords(sessions),
    tasksDone: totals?.tasks ?? 0,
    journalEntries: totals?.journal ?? 0,
    journalStreak: longestRun(journalDays.map((row) => row.date)),
    dailyReviews: Number((await getSetting(db, 'review_count')) ?? 0) || 0,
    weeklyReviews: totals?.weekly ?? 0,
    sleepLogs: totals?.sleep ?? 0,
    goalsAchieved,
    notes: totals?.notes ?? 0,
  };
}

/** Id odznak widzianych już na ekranie osiągnięć. */
export function parseSeen(value: string | null): Set<string> {
  if (!value) return new Set();
  try {
    const parsed: unknown = JSON.parse(value);
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}
