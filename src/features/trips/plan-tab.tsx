import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CheckCircle } from '@/components/check-circle';
import { Chip, ChipRow } from '@/components/chip';
import { EmptyLine } from '@/components/empty-state';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import { addTripItems, deleteTripItem, toggleTripItem, updateTripItem, type Trip, type TripItem } from '@/db/trips';
import { WEEKDAYS_SHORT, formatDayLong, relativeDayLabel, weekdayIndex, type DateKey } from '@/lib/dates';
import { capitalize } from '@/lib/format';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { planDays, tripDates, tripDayNumber } from './trips';

type PlanTarget = { item?: TripItem; date: DateKey | null };

export function PlanTab({ trip, items, today }: { trip: Trip; items: TripItem[]; today: DateKey }) {
  const db = useSQLiteContext();
  const { dark } = useTheme();
  const color = paletteColor(trip.color, dark);
  const [target, setTarget] = useState<PlanTarget | null>(null);

  return (
    <>
      {planDays(trip, items).map((day) => {
        const title = day.date
          ? `Dzień ${tripDayNumber(trip, day.date)} · ${capitalize(relativeDayLabel(day.date, today) ?? formatDayLong(day.date))}`
          : 'Pomysły i miejsca';
        return (
          <Section key={day.date ?? 'ideas'} title={title} onAdd={() => setTarget({ date: day.date })}>
            {day.date === null && day.items.length === 0 ? (
              <EmptyLine text="Co zobaczyć, gdzie zjeść — bez konkretnego dnia." />
            ) : null}
            {day.items.map((item) => (
              <Card key={item.id} variant="row" onPress={() => setTarget({ item, date: item.date })} style={styles.compactRow}>
                <CheckCircle
                  checked={Boolean(item.done)}
                  onPress={() => toggleTripItem(db, item)}
                  color={color}
                  accessibilityLabel={item.done ? `Cofnij: ${item.text}` : `Zrobione: ${item.text}`}
                />
                {item.time ? <AppText variant="bodyStrong">{item.time}</AppText> : null}
                <AppText style={styles.flex} tone={item.done ? 'textMuted' : 'text'}>
                  {item.text}
                </AppText>
              </Card>
            ))}
          </Section>
        );
      })}
      <PlanSheet target={target} trip={trip} onClose={() => setTarget(null)} />
    </>
  );
}

function PlanSheet({ target, trip, onClose }: { target: PlanTarget | null; trip: Trip; onClose: () => void }) {
  return (
    <BottomSheet visible={target !== null} onClose={onClose} gap={spacing.md}>
      {target ? <PlanContent target={target} trip={trip} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function PlanContent({ target, trip, onClose }: { target: PlanTarget; trip: Trip; onClose: () => void }) {
  const db = useSQLiteContext();
  const [text, setText] = useState(target.item?.text ?? '');
  const [date, setDate] = useState<DateKey | null>(target.date);
  const [time, setTime] = useState<string | null>(target.item?.time ?? null);
  const [timeOpen, setTimeOpen] = useState(false);
  const trimmed = text.trim();

  const save = async () => {
    if (!trimmed) return;
    const planTime = date ? time : null;
    if (target.item) await updateTripItem(db, target.item.id, { text: trimmed, category: '', date, time: planTime });
    else await addTripItems(db, trip.id, [{ kind: 'plan', text: trimmed, category: '', date, time: planTime }]);
    onClose();
  };

  const remove = async () => {
    if (target.item) await deleteTripItem(db, target.item.id);
    onClose();
  };

  return (
    <>
      <AppText variant="heading">{target.item ? 'Punkt planu' : 'Do planu'}</AppText>
      <TextField
        value={text}
        onChangeText={setText}
        placeholder="np. Koloseum, kolacja na Zatybrzu"
        autoFocus={!target.item}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <ChipRow>
        <Chip label="Pomysł" selected={date === null} onPress={() => setDate(null)} />
        {tripDates(trip).map((day, index) => (
          <Chip
            key={day}
            label={`${index + 1} · ${WEEKDAYS_SHORT[weekdayIndex(day)]}`}
            selected={date === day}
            onPress={() => setDate(day)}
          />
        ))}
      </ChipRow>
      {date ? (
        <ChipRow>
          <Chip label="Bez godziny" selected={time === null} onPress={() => setTime(null)} />
          <Chip label={time ?? 'Godzina'} icon="schedule" selected={time !== null} onPress={() => setTimeOpen(true)} />
        </ChipRow>
      ) : null}
      <SheetActions>
        {target.item ? <Button label="Usuń" variant="secondary" icon="delete" onPress={remove} /> : <Button label="Anuluj" variant="secondary" onPress={onClose} />}
        <Button label="Zapisz" onPress={save} disabled={!trimmed} />
      </SheetActions>
      <TimePickerSheet visible={timeOpen} title="Godzina" value={time ?? '10:00'} onChange={setTime} onClose={() => setTimeOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  compactRow: { paddingVertical: spacing.sm },
});
