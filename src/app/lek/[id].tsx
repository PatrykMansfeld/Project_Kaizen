import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { ColorSwatches } from '@/components/color-swatches';
import { EmojiBadge } from '@/components/emoji-badge';
import { EmojiPicker } from '@/components/emoji-picker';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import { createMedication, deleteMedication, getMedication, parseTimes, updateMedication } from '@/db/meds';
import { EVERY_DAY } from '@/features/habits/streak';
import { MED_ICONS } from '@/features/meds/meds';
import { requestPermissionOrWarn } from '@/features/reminders/permission';
import { EXPO_GO_NOTICE, notificationsSupported } from '@/features/reminders/reminders';
import { confirmDelete } from '@/lib/alerts';
import { WEEKDAYS_SHORT } from '@/lib/dates';
import { PALETTE, PALETTE_KEYS, paletteColor, type PaletteKey } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const PER_DOSE = [1, 2, 3];

type Form = {
  name: string;
  dose: string;
  icon: string;
  color: PaletteKey;
  scheduled: boolean;
  times: string[];
  daysMask: number;
  stock: string;
  perDose: number;
  reminders: boolean;
  active: boolean;
  notes: string;
};

/** Nowy lek: /lek/nowy, edycja: /lek/3. */
export default function MedicationEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowy';
  const medId = Number(id);

  const db = useSQLiteContext();
  const { dark } = useTheme();
  const [form, setForm] = useState<Form>({
    name: '',
    dose: '',
    icon: MED_ICONS[0],
    color: 'red',
    scheduled: true,
    times: ['08:00'],
    daysMask: EVERY_DAY,
    stock: '',
    perDose: 1,
    reminders: true,
    active: true,
    notes: '',
  });
  const [loaded, setLoaded] = useState(isNew);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getMedication(db, medId).then((med) => {
      if (!med) {
        router.back();
        return;
      }
      const times = parseTimes(med.times);
      setForm({
        name: med.name,
        dose: med.dose,
        icon: med.icon,
        color: (med.color in PALETTE ? med.color : 'red') as PaletteKey,
        scheduled: times.length > 0,
        times: times.length ? times : ['08:00'],
        daysMask: med.days_mask,
        stock: med.stock !== null ? String(med.stock) : '',
        perDose: med.per_dose,
        reminders: med.reminders === 1,
        active: med.active === 1,
        notes: med.notes,
      });
      setLoaded(true);
    });
  }, [db, isNew, medId]);

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const stock = form.stock.trim() === '' ? null : /^\d+$/.test(form.stock.trim()) ? Number(form.stock.trim()) : NaN;
  const stockValid = stock === null || !Number.isNaN(stock);
  const canSave = loaded && form.name.trim().length > 0 && stockValid && (!form.scheduled || form.times.length > 0);
  const color = paletteColor(form.color, dark);

  const addTime = (time: string) => {
    update({ times: [...new Set([...form.times, time])].sort() });
    if (form.reminders) {
      void requestPermissionOrWarn('Lek zostanie zapisany, ale przypomnienia nie przyjdą, dopóki nie włączysz powiadomień.');
    }
  };

  const toggleDay = (index: number) => {
    const mask = form.daysMask ^ (1 << index);
    if (mask !== 0) update({ daysMask: mask });
  };

  const save = async () => {
    if (!canSave) return;
    const input = {
      name: form.name.trim(),
      dose: form.dose.trim(),
      icon: form.icon,
      color: form.color,
      times: form.scheduled ? form.times : [],
      days_mask: form.daysMask,
      stock,
      per_dose: form.perDose,
      reminders: form.reminders,
      active: form.active,
      notes: form.notes.trim(),
    };
    if (isNew) await createMedication(db, input);
    else await updateMedication(db, medId, input);
    router.back();
  };

  const remove = () =>
    confirmDelete('Usunąć lek?', 'Historia odhaczonych dawek też zostanie usunięta. Możesz go zamiast tego wstrzymać.', async () => {
      await deleteMedication(db, medId);
      router.back();
    });

  return (
    <>
      <ScrollScreen
        title={isNew ? 'Nowy lek' : 'Lek'}
        headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
        {loaded ? (
          <>
            <View style={styles.preview}>
              <EmojiBadge emoji={form.icon} color={color} size={72} />
            </View>

            <TextField
              label="Nazwa"
              value={form.name}
              onChangeText={(name) => update({ name })}
              placeholder="np. Witamina D, Magnez"
              autoFocus={isNew}
              maxLength={40}
            />
            <TextField
              label="Dawka"
              value={form.dose}
              onChangeText={(dose) => update({ dose })}
              placeholder="np. 1 tabletka, 2000 j.m. (opcjonalnie)"
              maxLength={40}
            />

            <Section title="Kiedy">
              <ChipRow>
                <Chip label="O stałych godzinach" selected={form.scheduled} onPress={() => update({ scheduled: true })} />
                <Chip label="Doraźnie" selected={!form.scheduled} onPress={() => update({ scheduled: false })} />
              </ChipRow>
              {form.scheduled ? (
                <>
                  <ChipRow>
                    {form.times.map((time) => (
                      <Chip
                        key={time}
                        label={`${time}  ✕`}
                        icon="schedule"
                        selected
                        onPress={() => update({ times: form.times.filter((item) => item !== time) })}
                      />
                    ))}
                    <Chip label="Dodaj godzinę" icon="add" selected={false} onPress={() => setTimePickerOpen(true)} />
                  </ChipRow>
                  <ChipRow>
                    {WEEKDAYS_SHORT.map((name, index) => (
                      <Chip
                        key={name}
                        label={name}
                        selected={((form.daysMask >> index) & 1) === 1}
                        onPress={() => toggleDay(index)}
                      />
                    ))}
                    <Chip label="Codziennie" selected={form.daysMask === EVERY_DAY} onPress={() => update({ daysMask: EVERY_DAY })} />
                  </ChipRow>
                  <ChipRow>
                    <Chip
                      label={form.reminders ? 'Przypomnienia włączone' : 'Bez przypomnień'}
                      icon={form.reminders ? 'notifications' : 'notifications_off'}
                      selected={form.reminders}
                      onPress={() => update({ reminders: !form.reminders })}
                    />
                  </ChipRow>
                  {form.reminders && !notificationsSupported ? (
                    <AppText variant="caption" tone="textMuted">
                      {EXPO_GO_NOTICE}
                    </AppText>
                  ) : null}
                </>
              ) : (
                <AppText variant="caption" tone="textMuted">
                  Lek doraźny odhaczasz przyciskiem „Wziąłem”, kiedy go bierzesz — bez przypomnień.
                </AppText>
              )}
            </Section>

            <Section title="Zapas (opcjonalnie)">
              <TextField
                value={form.stock}
                onChangeText={(text) => update({ stock: text.replace(/\D/g, '') })}
                placeholder="ile sztuk masz, np. 60"
                keyboardType="number-pad"
                maxLength={5}
              />
              <ChipRow>
                {PER_DOSE.map((count) => (
                  <Chip
                    key={count}
                    label={`${count} szt. na dawkę`}
                    selected={form.perDose === count}
                    onPress={() => update({ perDose: count })}
                  />
                ))}
              </ChipRow>
              <AppText variant="caption" tone="textMuted">
                Każda odhaczona dawka zmniejsza zapas — zobaczysz, na ile dni jeszcze starczy.
              </AppText>
            </Section>

            <Section title="Ikona">
              <EmojiPicker options={MED_ICONS} value={form.icon} onChange={(icon) => update({ icon })} color={color} />
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
              label="Notatki"
              value={form.notes}
              onChangeText={(notes) => update({ notes })}
              placeholder="np. po jedzeniu, do kiedy brać (opcjonalnie)"
              multiline
            />

            {!isNew ? (
              <View style={styles.danger}>
                <Button
                  label={form.active ? 'Wstrzymaj' : 'Wznów'}
                  icon={form.active ? 'pause' : 'play_arrow'}
                  variant="secondary"
                  onPress={() => update({ active: !form.active })}
                />
                {!form.active ? (
                  <AppText variant="caption" tone="textMuted">
                    Wstrzymany lek nie pojawia się w dawkach ani przypomnieniach. Zapisz, żeby zatwierdzić.
                  </AppText>
                ) : null}
                <Button label="Usuń lek" variant="danger" icon="delete" onPress={remove} />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollScreen>

      <TimePickerSheet
        visible={timePickerOpen}
        title="Godzina dawki"
        value="08:00"
        onChange={addTime}
        onClose={() => setTimePickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center' },
  danger: { gap: spacing.sm },
});
