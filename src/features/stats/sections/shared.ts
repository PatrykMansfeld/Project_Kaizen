import type { Period, PeriodRange } from '@/features/stats/compute';
import { WEEKDAYS_SHORT, type DateKey } from '@/lib/dates';
import { formatSigned } from '@/lib/format';

export type SectionProps = { range: PeriodRange; period: Period; today: DateKey };

/** „+2 vs poprzedni tydzień” — albo nic, gdy nie ma z czym porównać. */
export function versus(diff: number | null, period: Period, format: (value: number) => string) {
  if (diff === null) return undefined;
  return `${formatSigned(diff, format)} vs poprzedni ${period === 'week' ? 'tydzień' : 'miesiąc'}`;
}

/** Podpis osi X wykresu dziennego: w tygodniu każdy dzień (pn…nd), w miesiącu co tydzień. */
export function dayAxisLabel(period: Period, days: DateKey[], index: number) {
  if (period === 'week') return WEEKDAYS_SHORT[index];
  return [0, 7, 14, 21, days.length - 1].includes(index) ? String(Number(days[index].slice(8))) : undefined;
}
