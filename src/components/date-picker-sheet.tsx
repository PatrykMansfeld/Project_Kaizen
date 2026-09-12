import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { MonthCalendar } from '@/components/month-calendar';
import { monthOf, type DateKey } from '@/lib/dates';

type Props = {
  visible: boolean;
  title: string;
  today: DateKey;
  value: DateKey | null;
  onChange: (day: DateKey | null) => void;
  onClose: () => void;
  /** Czy pokazać „Bez daty” (usunięcie daty). */
  clearable?: boolean;
};

/** Wysuwany od dołu wybór daty. Wybranie dnia od razu zamyka okno. */
export function DatePickerSheet({ visible, onClose, ...rest }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* Zawartość montuje się przy każdym otwarciu, więc kalendarz startuje od wybranego miesiąca. */}
      <SheetContent onClose={onClose} {...rest} />
    </BottomSheet>
  );
}

function SheetContent({ title, today, value, onChange, onClose, clearable = true }: Omit<Props, 'visible'>) {
  const [month, setMonth] = useState(() => monthOf(value ?? today));

  const pick = (day: DateKey | null) => {
    onChange(day);
    onClose();
  };

  return (
    <>
      <AppText variant="heading">{title}</AppText>
      <MonthCalendar today={today} selected={value} onSelect={pick} month={month} onMonthChange={setMonth} />
      <SheetActions>
        {clearable ? <Button label="Bez daty" variant="secondary" onPress={() => pick(null)} /> : null}
        <Button label="Anuluj" variant="secondary" onPress={onClose} />
      </SheetActions>
    </>
  );
}
