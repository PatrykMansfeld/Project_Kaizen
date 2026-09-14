import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ColorSwatches } from '@/components/color-swatches';
import { DateChoice } from '@/components/date-choice';
import { EmojiBadge } from '@/components/emoji-badge';
import { EmojiPicker } from '@/components/emoji-picker';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { createTrip, deleteTrip, getTrip, getTripPhotoUris, updateTrip } from '@/db/trips';
import { moneyInputText, parseMoney } from '@/features/finance/money';
import { TRIP_ICONS, tripLength } from '@/features/trips/trips';
import { confirmDelete } from '@/lib/alerts';
import { addDays, diffDays, type DateKey } from '@/lib/dates';
import { FORMS, plural } from '@/lib/format';
import { deleteImageFiles } from '@/lib/images';
import { useEditRecord } from '@/lib/use-edit-record';
import { useToday } from '@/lib/use-today';
import { PALETTE, PALETTE_KEYS, paletteColor, type PaletteKey } from '@/theme/palette';
import { useTheme } from '@/theme/use-theme';

type Form = {
  name: string;
  destination: string;
  icon: string;
  color: PaletteKey;
  start: DateKey;
  end: DateKey;
  budget: string;
  note: string;
};

/** Nowa podróż: /podroz/edycja/nowa, edycja: /podroz/edycja/3. */
export default function TripEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowa';
  const tripId = Number(id);

  const db = useSQLiteContext();
  const today = useToday();
  const { dark } = useTheme();
  const [form, setForm] = useState<Form>({
    name: '',
    destination: '',
    icon: TRIP_ICONS[0],
    color: 'blue',
    start: addDays(today, 14),
    end: addDays(today, 20),
    budget: '',
    note: '',
  });

  const loaded = useEditRecord(isNew ? null : tripId, () => getTrip(db, tripId), (trip) => {
    setForm({
      name: trip.name,
      destination: trip.destination,
      icon: trip.icon,
      color: (trip.color in PALETTE ? trip.color : 'blue') as PaletteKey,
      start: trip.start_date,
      end: trip.end_date,
      budget: trip.budget ? moneyInputText(trip.budget) : '',
      note: trip.note,
    });
  });

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const color = paletteColor(form.color, dark);
  const budget = parseMoney(form.budget);
  const budgetValid = budget === null || (!Number.isNaN(budget) && budget > 0);
  const canSave = loaded && form.name.trim().length > 0 && budgetValid;
  const length = tripLength({ start_date: form.start, end_date: form.end });

  // Nowy termin wyjazdu przesuwa powrót tak, żeby wyjazd trwał tyle samo.
  const setStart = (start: DateKey) => update({ start, end: addDays(start, diffDays(form.start, form.end)) });

  const save = async () => {
    if (!canSave) return;
    const input = {
      name: form.name.trim(),
      destination: form.destination.trim(),
      icon: form.icon,
      color: form.color,
      start_date: form.start,
      end_date: form.end,
      budget,
      note: form.note.trim(),
    };
    if (isNew) {
      const result = await createTrip(db, input);
      router.replace({ pathname: '/podroz/[id]', params: { id: String(result.lastInsertRowId) } });
      return;
    }
    await updateTrip(db, tripId, input);
    router.back();
  };

  const remove = () =>
    confirmDelete('Usunąć podróż?', 'Plan, lista pakowania i zdjęcia zostaną usunięte. Wydatki zostaną w module Wydatki.', async () => {
      const uris = await getTripPhotoUris(db, tripId);
      await deleteTrip(db, tripId);
      deleteImageFiles(uris);
      // Ekran podróży pod spodem sam się zamknie, gdy podróż zniknie.
      router.back();
    });

  return (
    <ScrollScreen title={isNew ? 'Nowa podróż' : 'Podróż'} headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
      {loaded ? (
        <>
          <View style={styles.preview}>
            <EmojiBadge emoji={form.icon} color={color} size={72} />
          </View>
          <TextField
            label="Nazwa"
            value={form.name}
            onChangeText={(name) => update({ name })}
            placeholder="np. Majówka w Rzymie"
            autoFocus={isNew}
            maxLength={60}
          />
          <TextField
            label="Dokąd"
            value={form.destination}
            onChangeText={(destination) => update({ destination })}
            placeholder="np. Rzym, Włochy"
            maxLength={60}
          />

          <Section title="Wyjazd">
            <DateChoice
              value={form.start}
              onChange={(start) => start && setStart(start)}
              today={today}
              pickerTitle="Dzień wyjazdu"
              presets={[
                { label: 'Dziś', date: today },
                { label: 'Jutro', date: addDays(today, 1) },
              ]}
            />
          </Section>
          <Section title="Powrót" meta={plural(length, FORMS.day)}>
            <DateChoice
              value={form.end}
              onChange={(end) => end && update({ end: end < form.start ? form.start : end })}
              today={today}
              pickerTitle="Dzień powrotu"
              presets={[
                { label: 'Ten sam dzień', date: form.start },
                { label: 'Weekend', date: addDays(form.start, 2) },
                { label: 'Tydzień', date: addDays(form.start, 6) },
                { label: '2 tygodnie', date: addDays(form.start, 13) },
              ]}
            />
          </Section>

          <TextField
            label="Budżet (zł)"
            value={form.budget}
            onChangeText={(text) => update({ budget: text })}
            placeholder="np. 4000 (opcjonalnie)"
            keyboardType="decimal-pad"
            maxLength={12}
          />
          {!budgetValid ? (
            <AppText variant="caption" tone="danger">
              Wpisz kwotę, np. 4000 albo 4000,50
            </AppText>
          ) : null}

          <Section title="Ikona">
            <EmojiPicker options={TRIP_ICONS} value={form.icon} onChange={(icon) => update({ icon })} color={color} />
          </Section>
          <Section title="Kolor">
            <ColorSwatches
              swatches={PALETTE_KEYS.map((key) => ({ key, label: PALETTE[key].label, color: paletteColor(key, dark) }))}
              value={form.color}
              onChange={(key) => update({ color: key })}
              checkColor="#FFFFFF"
            />
          </Section>

          <TextField
            label="Notatki i wspomnienia"
            value={form.note}
            onChangeText={(note) => update({ note })}
            placeholder="Nocleg, numery rezerwacji, a po powrocie — co zapamiętać"
            multiline
          />

          {!isNew ? <Button label="Usuń podróż" variant="danger" icon="delete" onPress={remove} /> : null}
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center' },
});
