import { useState } from 'react';

import { Chip, ChipRow } from '@/components/chip';
import { DatePickerSheet } from '@/components/date-picker-sheet';
import { formatDayShort, type DateKey } from '@/lib/dates';

export type DatePreset = { label: string; date: DateKey | null };

type Props = {
  value: DateKey | null;
  onChange: (date: DateKey | null) => void;
  today: DateKey;
  /** Szybkie opcje, np. „Dziś”, „Wczoraj” (date: null = „Brak”). */
  presets: DatePreset[];
  /** Tytuł kalendarza „Inna data”. */
  pickerTitle: string;
};

/** Wybór daty: kilka szybkich opcji i „Inna data” z kalendarzem. */
export function DateChoice({ value, onChange, today, presets, pickerTitle }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const custom = value !== null && !presets.some((preset) => preset.date === value);
  const clearable = presets.some((preset) => preset.date === null);

  return (
    <>
      <ChipRow>
        {presets.map((preset) => (
          <Chip key={preset.label} label={preset.label} selected={value === preset.date} onPress={() => onChange(preset.date)} />
        ))}
        <Chip
          label={custom ? formatDayShort(value, today) : 'Inna data'}
          icon="calendar_month"
          selected={custom}
          onPress={() => setPickerOpen(true)}
        />
      </ChipRow>
      <DatePickerSheet
        visible={pickerOpen}
        title={pickerTitle}
        today={today}
        value={value}
        onChange={(day) => (day || clearable) && onChange(day)}
        onClose={() => setPickerOpen(false)}
        clearable={clearable}
      />
    </>
  );
}
