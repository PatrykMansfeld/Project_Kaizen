import { Chip } from '@/components/chip';
import { PeriodNavigator } from '@/components/period-navigator';
import { addDays, formatDayLong, relativeDayLabel, type DateKey } from '@/lib/dates';

type Props = {
  date: DateKey;
  today: DateKey;
  onChange: (date: DateKey) => void;
  /** Najpóźniejszy dozwolony dzień (np. dziś dla dziennika). */
  maxDate?: DateKey;
};

/** ‹ czwartek, 10 września › — przełączanie dzień po dniu. */
export function DayNavigator({ date, today, onChange, maxDate }: Props) {
  return (
    <PeriodNavigator
      title={formatDayLong(date)}
      subtitle={relativeDayLabel(date, today) ?? <Chip label="Wróć do dziś" selected={false} onPress={() => onChange(today)} />}
      onPrevious={() => onChange(addDays(date, -1))}
      onNext={() => onChange(addDays(date, 1))}
      canGoNext={!maxDate || date < maxDate}
      unitLabel={{ previous: 'Poprzedni dzień', next: 'Następny dzień' }}
      compact
    />
  );
}
