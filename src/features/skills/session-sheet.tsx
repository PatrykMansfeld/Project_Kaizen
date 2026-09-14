import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { DateChoice, recentDayPresets } from '@/components/date-choice';
import { TextField } from '@/components/text-field';
import { addSession, deleteSession, updateSession, type PracticeSession } from '@/db/skills';
import { type DateKey } from '@/lib/dates';
import { formatDuration, parseWholeNumber } from '@/lib/format';

const MINUTES = [15, 30, 45, 60, 90, 120];

type Props = {
  /** Nowa sesja: { skillId }, edycja: { session }. null = zamknięte. */
  target: { skillId: number; session?: PracticeSession } | null;
  today: DateKey;
  onClose: () => void;
};

/** Dodanie albo edycja sesji praktyki: czas, dzień i notatka. */
export function SessionSheet({ target, today, onClose }: Props) {
  return (
    <BottomSheet visible={target !== null} onClose={onClose}>
      {target ? <SessionForm target={target} today={today} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function SessionForm({ target, today, onClose }: Props & { target: NonNullable<Props['target']> }) {
  const db = useSQLiteContext();
  const existing = target.session;
  const [minutes, setMinutes] = useState(existing ? String(existing.minutes) : '30');
  const [date, setDate] = useState<DateKey>(existing?.date ?? today);
  const [note, setNote] = useState(existing?.note ?? '');
  const value = parseWholeNumber(minutes) ?? 0;
  const valid = value > 0 && value <= 24 * 60;

  const save = async () => {
    if (!valid) return;
    if (existing) await updateSession(db, existing.id, { date, minutes: value, note: note.trim() });
    else await addSession(db, { skill_id: target.skillId, date, minutes: value, note: note.trim() });
    onClose();
  };

  const remove = async () => {
    if (existing) await deleteSession(db, existing.id);
    onClose();
  };

  return (
    <>
      <AppText variant="heading">{existing ? 'Sesja praktyki' : 'Nowa sesja'}</AppText>
      <ChipRow>
        {MINUTES.map((option) => (
          <Chip key={option} label={formatDuration(option)} selected={value === option} onPress={() => setMinutes(String(option))} />
        ))}
      </ChipRow>
      <TextField
        label="Minuty"
        value={minutes}
        onChangeText={(text) => setMinutes(text.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={4}
      />
      <DateChoice
        value={date}
        onChange={(day) => day && setDate(day)}
        today={today}
        pickerTitle="Dzień sesji"
        presets={recentDayPresets(today)}
      />
      <TextField value={note} onChangeText={setNote} placeholder="Co ćwiczyłeś? (opcjonalnie)" maxLength={120} />
      <SheetActions>
        {existing ? <Button label="Usuń" variant="danger" onPress={remove} /> : <Button label="Anuluj" variant="secondary" onPress={onClose} />}
        <Button label="Zapisz" onPress={save} disabled={!valid} />
      </SheetActions>
    </>
  );
}
