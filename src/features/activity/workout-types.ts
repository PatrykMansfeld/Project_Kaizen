import type { IconName } from '@/components/icon';
import { formatDecimal } from '@/lib/format';

export const WORKOUT_TYPES = {
  walk: { label: 'Spacer', icon: 'directions_walk', hasDistance: true },
  run: { label: 'Bieg', icon: 'directions_run', hasDistance: true },
  bike: { label: 'Rower', icon: 'directions_bike', hasDistance: true },
  gym: { label: 'Siłownia', icon: 'fitness_center', hasDistance: false },
  swim: { label: 'Pływanie', icon: 'pool', hasDistance: true },
  other: { label: 'Inne', icon: 'exercise', hasDistance: true },
} as const satisfies Record<string, { label: string; icon: IconName; hasDistance: boolean }>;

export type WorkoutType = keyof typeof WORKOUT_TYPES;

export const WORKOUT_TYPE_KEYS = Object.keys(WORKOUT_TYPES) as WorkoutType[];

/** Tempo dla spaceru i biegu („5:30 /km”), prędkość dla roweru („24,5 km/h”). */
export function workoutPace(type: WorkoutType, minutes: number | null, km: number | null) {
  if (!minutes || !km) return null;
  if (type === 'run' || type === 'walk') {
    const secondsPerKm = Math.round((minutes * 60) / km);
    const min = Math.floor(secondsPerKm / 60);
    const sec = String(secondsPerKm % 60).padStart(2, '0');
    return `${min}:${sec} /km`;
  }
  if (type === 'bike') return `${formatDecimal(km / (minutes / 60), 1)} km/h`;
  return null;
}
