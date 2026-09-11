import type { IconName } from '@/components/icon';
import type { Goal, GoalKind } from '@/db/goals';
import { MEASUREMENT_TYPES } from '@/db/measurements';
import { diffDays, type DateKey } from '@/lib/dates';
import { formatDecimal, formatDuration, plural } from '@/lib/format';

export const GOAL_KINDS: Record<GoalKind, { label: string; icon: IconName; hint: string }> = {
  distance: { label: 'Dystans', icon: 'social_distance', hint: 'Suma kilometrów z treningów' },
  workouts: { label: 'Treningi', icon: 'fitness_center', hint: 'Liczba treningów' },
  minutes: { label: 'Czas', icon: 'timer', hint: 'Suma czasu treningów' },
  habit: { label: 'Nawyk', icon: 'check_circle', hint: 'Dni z wykonanym nawykiem' },
  measurement: { label: 'Pomiar', icon: 'monitor_weight', hint: 'Np. waga z 82 do 78 kg' },
  manual: { label: 'Własny', icon: 'flag', hint: 'Postęp dodajesz ręcznie, np. przeczytane książki' },
};

export const GOAL_KIND_KEYS = Object.keys(GOAL_KINDS) as GoalKind[];

type GoalFields = Pick<Goal, 'kind' | 'target' | 'unit' | 'measurement_type' | 'start_value'>;

/** Wartość w jednostce celu: „12,4 km”, „8 treningów”, „5 h 20 min”, „18 dni”, „80,2 kg”, „3 książek”. */
export function formatGoalValue(goal: GoalFields, value: number) {
  switch (goal.kind) {
    case 'distance':
      return `${formatDecimal(value, 1)} km`;
    case 'workouts':
      return plural(Math.round(value), ['trening', 'treningi', 'treningów']);
    case 'minutes':
      return formatDuration(Math.round(value));
    case 'habit':
      return plural(Math.round(value), ['dzień', 'dni', 'dni']);
    case 'measurement':
      return `${formatDecimal(value, 1)} ${goal.measurement_type ? MEASUREMENT_TYPES[goal.measurement_type].unit : ''}`;
    case 'manual':
      return `${formatDecimal(value, 1)} ${goal.unit ?? ''}`.trim();
  }
}

/** „12,4 km z 100 km” albo dla pomiaru „80,2 kg · cel 78 kg”. */
export function goalProgressText(goal: GoalFields, value: number | null) {
  if (goal.kind === 'measurement') {
    return value === null ? `Brak pomiaru · cel ${formatGoalValue(goal, goal.target)}` : `${formatGoalValue(goal, value)} · cel ${formatGoalValue(goal, goal.target)}`;
  }
  return `${formatGoalValue(goal, value ?? 0)} z ${formatGoalValue(goal, goal.target)}`;
}

export type GoalStatus = 'done' | 'expired' | 'upcoming' | 'ahead' | 'behind';

/** Czy postęp nadąża za upływem czasu (np. 40% drogi przy 50% czasu = poniżej planu). */
export function goalStatus(goal: Pick<Goal, 'start_date' | 'end_date'>, fraction: number, today: DateKey): GoalStatus {
  if (fraction >= 1) return 'done';
  if (today > goal.end_date) return 'expired';
  if (today < goal.start_date) return 'upcoming';
  const elapsed = (diffDays(goal.start_date, today) + 1) / (diffDays(goal.start_date, goal.end_date) + 1);
  return fraction >= elapsed ? 'ahead' : 'behind';
}

/** Ile trzeba robić, żeby zdążyć: „~4,4 km tygodniowo”. Null, gdy nie ma sensu (zrobione, po terminie, pomiar). */
export function goalPace(goal: GoalFields & Pick<Goal, 'end_date'>, value: number, today: DateKey) {
  if (goal.kind === 'measurement' || value >= goal.target || today > goal.end_date) return null;
  const daysLeft = diffDays(today, goal.end_date) + 1;
  const remaining = goal.target - value;
  if (goal.kind === 'habit') {
    return `jeszcze ${plural(Math.ceil(remaining), ['dzień', 'dni', 'dni'])} · zostało ${plural(daysLeft, ['dzień', 'dni', 'dni'])}`;
  }
  if (daysLeft < 7) return `~${formatGoalValue(goal, remaining / daysLeft)} dziennie`;
  return `~${formatGoalValue(goal, remaining / (daysLeft / 7))} tygodniowo`;
}
