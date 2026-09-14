import type { Attribute } from '@/db/habits';
import type { MediaKind } from '@/db/media';
import type { IconName } from '@/components/icon';
import { habitStartDay, isScheduled } from '@/features/habits/streak';
import { addDays, addMonths, startOfWeek, toDateKey, type DateKey } from '@/lib/dates';
import type { ThemeColors } from '@/theme/theme';

// ——— Cechy ————————————————————————————————————————————————————————————————

type AttributeInfo = {
  label: string;
  color: keyof ThemeColors;
  icon: IconName;
  /** Co podnosi cechę — do podpowiedzi „zostaje w tyle”. */
  boost: string;
};

export const ATTRIBUTES: Record<Attribute, AttributeInfo> = {
  body: { label: 'Ciało', color: 'activity', icon: 'fitness_center', boost: 'trening, zapisany sen, pomiar albo nawyk dla ciała' },
  mind: { label: 'Umysł', color: 'tasks', icon: 'psychology', boost: 'praktyka umiejętności, książka albo nawyk dla umysłu' },
  order: { label: 'Porządek', color: 'finance', icon: 'cleaning_services', boost: 'zadania, obowiązki domowe albo opłacony rachunek' },
  spirit: { label: 'Duch', color: 'journal', icon: 'self_improvement', boost: 'wpis w dzienniku, podsumowanie dnia, przegląd tygodnia albo spełnione marzenie' },
};

export const ATTRIBUTE_KEYS: Attribute[] = ['body', 'mind', 'order', 'spirit'];

const ICON_ATTRIBUTES: Record<string, Attribute> = {};
for (const icon of ['💧', '🏃', '🚶', '🚴', '🏊', '💪', '😴', '🛏️', '🦷', '🚿', '💊', '🍎', '🥗', '🥛', '🚭', '👟', '🥤', '🧴']) {
  ICON_ATTRIBUTES[icon] = 'body';
}
for (const icon of ['📚', '🧠', '💻', '🎸', '🎨', '📖', '✍️', '🎯']) ICON_ATTRIBUTES[icon] = 'mind';
for (const icon of ['🧹', '💰', '🐶']) ICON_ATTRIBUTES[icon] = 'order';

/** Podpowiedź cechy po ikonie nawyku (ta sama lista co w migracji 11); nieznana ikona → duch. */
export function guessAttribute(icon: string): Attribute {
  return ICON_ATTRIBUTES[icon] ?? 'spirit';
}

// ——— Źródła punktów ——————————————————————————————————————————————————————

export type XpSource =
  | 'habit'
  | 'perfectDay'
  | 'task'
  | 'chore'
  | 'bill'
  | 'budget'
  | 'workout'
  | 'record'
  | 'sleep'
  | 'dose'
  | 'measurement'
  | 'practice'
  | 'book'
  | 'title'
  | 'journal'
  | 'review'
  | 'weekly'
  | 'goal'
  | 'dream';

type SourceInfo = {
  /** Nazwa w zestawieniu „skąd punkty”. */
  label: string;
  /** Opis w tabeli „za co są punkty”. */
  rule: string;
  xp: string;
  limit?: string;
  /** null — cecha zależy od nawyku albo celu. */
  attribute: Attribute | null;
};

/** Ile punktów za co. Nagradzamy regularność: źródła, które łatwo „nabić”, mają dzienny limit. */
export const XP = {
  habit: 10,
  perfectDay: 20,
  task: 5,
  chore: 10,
  bill: 5,
  budget: 100,
  workout: 25,
  record: 30,
  sleep: 5,
  dose: 3,
  measurement: 5,
  book: 40,
  title: 15,
  journal: 10,
  review: 10,
  weekly: 40,
  goal: 100,
  dream: 50,
} as const;

export const XP_LIMITS = { tasks: 10, workouts: 2, doses: 5, practiceMinutes: 120 } as const;

/** Praktyka: 10 XP za każde 30 minut (liczone proporcjonalnie, co 3 minuty). */
export function practiceXp(minutes: number) {
  return Math.floor(Math.min(Math.max(minutes, 0), XP_LIMITS.practiceMinutes) / 3);
}

export const XP_SOURCES: Record<XpSource, SourceInfo> = {
  habit: { label: 'Nawyki', rule: 'Nawyk: dzienny cel osiągnięty', xp: `${XP.habit}`, attribute: null },
  perfectDay: { label: 'Pełne dni nawyków', rule: 'Wszystkie zaplanowane nawyki dnia', xp: `+${XP.perfectDay}`, attribute: 'spirit' },
  task: { label: 'Zadania', rule: 'Zadanie ukończone', xp: `${XP.task}`, limit: `${XP_LIMITS.tasks} dziennie`, attribute: 'order' },
  chore: { label: 'Obowiązki domowe', rule: 'Obowiązek domowy', xp: `${XP.chore}`, attribute: 'order' },
  bill: { label: 'Opłaty', rule: 'Opłata zapłacona', xp: `${XP.bill}`, attribute: 'order' },
  budget: { label: 'Miesiące w budżecie', rule: 'Miesiąc zamknięty w budżecie', xp: `${XP.budget}`, limit: 'raz na miesiąc', attribute: 'order' },
  workout: { label: 'Treningi', rule: 'Trening', xp: `${XP.workout}`, limit: `${XP_LIMITS.workouts} dziennie`, attribute: 'body' },
  record: { label: 'Rekordy', rule: 'Pobity rekord ciężaru', xp: `${XP.record}`, attribute: 'body' },
  sleep: { label: 'Sen', rule: 'Sen zapisany', xp: `${XP.sleep}`, limit: '1 dziennie', attribute: 'body' },
  dose: { label: 'Leki', rule: 'Dawka leku', xp: `${XP.dose}`, limit: `${XP_LIMITS.doses} dziennie`, attribute: 'body' },
  measurement: { label: 'Pomiary', rule: 'Pomiar ciała', xp: `${XP.measurement}`, limit: '1 dziennie', attribute: 'body' },
  practice: { label: 'Praktyka', rule: 'Praktyka umiejętności', xp: '10 za 30 min', limit: '2 h dziennie', attribute: 'mind' },
  book: { label: 'Książki', rule: 'Przeczytana książka', xp: `${XP.book}`, attribute: 'mind' },
  title: { label: 'Kultura', rule: 'Ukończony film, serial, anime, manga lub gra', xp: `${XP.title}`, attribute: 'mind' },
  journal: { label: 'Dziennik', rule: 'Wpis w dzienniku', xp: `${XP.journal}`, limit: '1 dziennie', attribute: 'spirit' },
  review: { label: 'Podsumowania dnia', rule: 'Podsumowanie dnia', xp: `${XP.review}`, limit: '1 dziennie', attribute: 'spirit' },
  weekly: { label: 'Przeglądy tygodnia', rule: 'Przegląd tygodnia', xp: `${XP.weekly}`, limit: '1 w tygodniu', attribute: 'spirit' },
  goal: { label: 'Cele', rule: 'Osiągnięty cel', xp: `${XP.goal}`, attribute: null },
  dream: { label: 'Marzenia', rule: 'Spełnione marzenie', xp: `${XP.dream}`, attribute: 'spirit' },
};

export const XP_SOURCE_KEYS = Object.keys(XP_SOURCES) as XpSource[];

// ——— Dane wejściowe (z bazy, db/xp.ts) ——————————————————————————————————————

export type DayCount = { date: DateKey; n: number };

export type XpHabit = {
  id: number;
  attribute: Attribute;
  days_mask: number;
  weekly_target: number | null;
  archived: 0 | 1;
  created_at: string;
};

export type XpData = {
  habits: XpHabit[];
  /** Dni z osiągniętym celem nawyku. */
  habitDone: { habit_id: number; date: DateKey }[];
  /** completed_at ukończonych zadań (UTC — dzień liczymy lokalnie). */
  tasks: string[];
  chores: DayCount[];
  bills: DayCount[];
  /** Suma wydatków w miesiącu ('YYYY-MM', grosze). */
  expenses: { month: string; total: number }[];
  budget: number | null;
  /** 'YYYY-MM' — pierwszy miesiąc z budżetem. */
  budgetSince: string | null;
  workouts: DayCount[];
  /** Najcięższa seria w każdym treningu ćwiczenia, posortowane po ćwiczeniu i dacie. */
  sessions: { exercise_id: number; date: DateKey; max_weight: number }[];
  sleep: DateKey[];
  doses: DayCount[];
  measurements: DateKey[];
  practice: { date: DateKey; minutes: number }[];
  media: { kind: MediaKind; finished_on: DateKey }[];
  journal: DateKey[];
  reviews: DateKey[];
  weekly: DateKey[];
  goals: { kind: string; habit_id: number | null; achieved_on: DateKey }[];
  /** Dni spełnienia marzeń. */
  dreams: DateKey[];
};

// ——— Liczenie ————————————————————————————————————————————————————————————

export type DayXp = {
  total: number;
  attributes: Record<Attribute, number>;
  sources: Partial<Record<XpSource, number>>;
};

/** Punkty dzień po dniu. */
export type XpLedger = Map<DateKey, DayXp>;

function emptyAttributes(): Record<Attribute, number> {
  return { body: 0, mind: 0, order: 0, spirit: 0 };
}

function lastDayOfMonth(month: string): DateKey {
  return addDays(addMonths(`${month}-01`, 1), -1);
}

/**
 * Liczy punkty z historii: nic nie jest zapisywane osobno, więc odznaczenie nawyku zabiera jego punkty,
 * a kopia zapasowa przenosi wszystko. Dni z przyszłości się nie liczą.
 */
export function computeXp(data: XpData, today: DateKey): XpLedger {
  const ledger: XpLedger = new Map();
  const add = (date: DateKey, source: XpSource, attribute: Attribute, xp: number) => {
    if (xp <= 0 || date > today) return;
    let day = ledger.get(date);
    if (!day) {
      day = { total: 0, attributes: emptyAttributes(), sources: {} };
      ledger.set(date, day);
    }
    day.total += xp;
    day.attributes[attribute] += xp;
    day.sources[source] = (day.sources[source] ?? 0) + xp;
  };

  // Nawyki: każdy osiągnięty cel + bonus za dzień, w którym zrobione są wszystkie zaplanowane.
  const habitsById = new Map(data.habits.map((habit) => [habit.id, habit]));
  const doneByHabit = new Map<number, Set<DateKey>>();
  for (const row of data.habitDone) {
    const habit = habitsById.get(row.habit_id);
    if (!habit) continue;
    add(row.date, 'habit', habit.attribute, XP.habit);
    let days = doneByHabit.get(row.habit_id);
    if (!days) doneByHabit.set(row.habit_id, (days = new Set()));
    days.add(row.date);
  }
  // Pełny dzień: aktywne nawyki „w wybrane dni” zaplanowane na ten dzień (od dnia, w którym nawyk powstał).
  const scheduled = data.habits
    .filter((habit) => habit.archived === 0 && habit.weekly_target === null)
    .map((habit) => ({ habit, done: doneByHabit.get(habit.id) ?? new Set<DateKey>() }))
    .map(({ habit, done }) => ({ habit, done, since: habitStartDay(habit.created_at, done) }));
  const doneDays = new Set(data.habitDone.map((row) => row.date));
  for (const date of doneDays) {
    const planned = scheduled.filter(({ habit, since }) => since <= date && isScheduled(habit.days_mask, date));
    if (planned.length > 0 && planned.every(({ done }) => done.has(date))) add(date, 'perfectDay', 'spirit', XP.perfectDay);
  }

  const tasksPerDay = new Map<DateKey, number>();
  for (const completedAt of data.tasks) {
    const date = toDateKey(new Date(completedAt));
    tasksPerDay.set(date, (tasksPerDay.get(date) ?? 0) + 1);
  }
  for (const [date, n] of tasksPerDay) add(date, 'task', 'order', Math.min(n, XP_LIMITS.tasks) * XP.task);

  for (const { date, n } of data.chores) add(date, 'chore', 'order', n * XP.chore);
  for (const { date, n } of data.bills) add(date, 'bill', 'order', n * XP.bill);

  // Miesiąc w budżecie: tylko zamknięte miesiące od ustawienia budżetu, z przynajmniej jednym wydatkiem.
  if (data.budget !== null && data.budgetSince !== null) {
    const currentMonth = today.slice(0, 7);
    for (const { month, total } of data.expenses) {
      if (month >= data.budgetSince && month < currentMonth && total > 0 && total <= data.budget) {
        add(lastDayOfMonth(month), 'budget', 'order', XP.budget);
      }
    }
  }

  for (const { date, n } of data.workouts) add(date, 'workout', 'body', Math.min(n, XP_LIMITS.workouts) * XP.workout);

  // Rekord: trening, w którym ciężar przebił najlepszy wcześniejszy (pierwszy trening ćwiczenia się nie liczy).
  let exercise: number | null = null;
  let best = 0;
  for (const session of data.sessions) {
    if (session.exercise_id !== exercise) {
      exercise = session.exercise_id;
      best = session.max_weight;
      continue;
    }
    if (session.max_weight > best) {
      add(session.date, 'record', 'body', XP.record);
      best = session.max_weight;
    }
  }

  for (const date of data.sleep) add(date, 'sleep', 'body', XP.sleep);
  for (const { date, n } of data.doses) add(date, 'dose', 'body', Math.min(n, XP_LIMITS.doses) * XP.dose);
  for (const date of data.measurements) add(date, 'measurement', 'body', XP.measurement);
  for (const { date, minutes } of data.practice) add(date, 'practice', 'mind', practiceXp(minutes));
  for (const { kind, finished_on } of data.media) {
    if (kind === 'book') add(finished_on, 'book', 'mind', XP.book);
    else add(finished_on, 'title', 'mind', XP.title);
  }
  for (const date of data.journal) add(date, 'journal', 'spirit', XP.journal);
  for (const date of data.reviews) add(date, 'review', 'spirit', XP.review);
  for (const date of data.weekly) add(date, 'weekly', 'spirit', XP.weekly);

  for (const goal of data.goals) {
    const attribute: Attribute =
      goal.kind === 'habit'
        ? (habitsById.get(goal.habit_id ?? -1)?.attribute ?? 'spirit')
        : goal.kind === 'manual'
          ? 'spirit'
          : 'body';
    add(goal.achieved_on, 'goal', attribute, XP.goal);
  }
  for (const date of data.dreams) add(date, 'dream', 'spirit', XP.dream);

  return ledger;
}

// ——— Poziomy ——————————————————————————————————————————————————————————————

/** Próg poziomu: 40·(L−1)² XP — poziom 2 pierwszego dnia, 10 po ok. 3 tygodniach, 50 po ok. 2 latach. */
export function levelThreshold(level: number) {
  return 40 * (level - 1) ** 2;
}

export type LevelInfo = {
  level: number;
  xp: number;
  /** Próg obecnego i następnego poziomu. */
  from: number;
  to: number;
  /** 0–1 w obecnym poziomie. */
  progress: number;
};

export function levelOf(xp: number): LevelInfo {
  const points = Math.max(0, Math.floor(xp));
  let level = Math.floor(Math.sqrt(points / 40)) + 1;
  // Poprawka na zaokrąglenia pierwiastka.
  while (levelThreshold(level + 1) <= points) level++;
  while (level > 1 && levelThreshold(level) > points) level--;
  const from = levelThreshold(level);
  const to = levelThreshold(level + 1);
  return { level, xp: points, from, to, progress: (points - from) / (to - from) };
}

// ——— Podsumowanie do ekranów ———————————————————————————————————————————————

export type XpSummary = {
  total: number;
  level: LevelInfo;
  attributes: Record<Attribute, { xp: number; level: LevelInfo }>;
  today: number;
  thisWeek: number;
  /** Zeszły tydzień do tego samego dnia tygodnia (uczciwe porównanie w trakcie tygodnia). */
  lastWeekSoFar: number;
  /** Ostatnie 12 tygodni, od najstarszego; `start` to poniedziałek. */
  weeks: { start: DateKey; xp: number }[];
  last30: { total: number; attributes: Record<Attribute, number>; sources: Partial<Record<XpSource, number>> };
};

function sumRange(ledger: XpLedger, from: DateKey, to: DateKey) {
  let sum = 0;
  for (const [date, day] of ledger) if (date >= from && date <= to) sum += day.total;
  return sum;
}

export function summarizeXp(ledger: XpLedger, today: DateKey): XpSummary {
  let total = 0;
  const attributeXp = emptyAttributes();
  const last30 = { total: 0, attributes: emptyAttributes(), sources: {} as Partial<Record<XpSource, number>> };
  const from30 = addDays(today, -29);
  for (const [date, day] of ledger) {
    total += day.total;
    for (const key of ATTRIBUTE_KEYS) attributeXp[key] += day.attributes[key];
    if (date >= from30 && date <= today) {
      last30.total += day.total;
      for (const key of ATTRIBUTE_KEYS) last30.attributes[key] += day.attributes[key];
      for (const [source, xp] of Object.entries(day.sources) as [XpSource, number][]) {
        last30.sources[source] = (last30.sources[source] ?? 0) + xp;
      }
    }
  }

  const monday = startOfWeek(today);
  const weeks = Array.from({ length: 12 }, (_, index) => {
    const start = addDays(monday, (index - 11) * 7);
    return { start, xp: sumRange(ledger, start, addDays(start, 6)) };
  });

  return {
    total,
    level: levelOf(total),
    attributes: Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => [key, { xp: attributeXp[key], level: levelOf(attributeXp[key]) }]),
    ) as XpSummary['attributes'],
    today: ledger.get(today)?.total ?? 0,
    thisWeek: sumRange(ledger, monday, today),
    lastWeekSoFar: sumRange(ledger, addDays(monday, -7), addDays(today, -7)),
    weeks,
    last30,
  };
}

/** Zmiana tydzień do tygodnia w procentach (null, gdy nie ma z czym porównać). */
export function weekChange(summary: Pick<XpSummary, 'thisWeek' | 'lastWeekSoFar'>) {
  if (summary.lastWeekSoFar <= 0) return null;
  return Math.round(((summary.thisWeek - summary.lastWeekSoFar) / summary.lastWeekSoFar) * 100);
}

/**
 * Cecha, która zostaje w tyle w ostatnich 30 dniach: ma mniej niż połowę średniej.
 * null, gdy danych jest za mało (poniżej 200 XP), żeby cokolwiek radzić.
 */
export function laggingAttribute(last30: Record<Attribute, number>): Attribute | null {
  const values = ATTRIBUTE_KEYS.map((key) => last30[key]);
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum < 200) return null;
  const weakest = ATTRIBUTE_KEYS.reduce((min, key) => (last30[key] < last30[min] ? key : min), ATTRIBUTE_KEYS[0]);
  return last30[weakest] < (sum / ATTRIBUTE_KEYS.length) * 0.5 ? weakest : null;
}

/** Przyrost punktów między dwoma podsumowaniami: ile XP i której cesze przybyło najwięcej. */
export function xpGain(before: XpSummary, after: XpSummary): { xp: number; attribute: Attribute } | null {
  const xp = after.total - before.total;
  if (xp <= 0) return null;
  const attribute = ATTRIBUTE_KEYS.reduce((top, key) => {
    const gain = after.attributes[key].xp - before.attributes[key].xp;
    return gain > after.attributes[top].xp - before.attributes[top].xp ? key : top;
  }, ATTRIBUTE_KEYS[0]);
  return { xp, attribute };
}

/** „12 340 XP” (spacja twarda między tysiącami, jak w kwotach). */
export function formatXp(xp: number) {
  return `${String(Math.round(xp)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0XP`;
}
