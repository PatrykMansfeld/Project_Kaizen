import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { DateChoice } from '@/components/date-choice';
import { EmojiPicker } from '@/components/emoji-picker';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { createChore, deleteChore, getChore, updateChore } from '@/db/home';
import { CHORE_INTERVALS, HOME_ICONS } from '@/features/home/home';
import { requestPermissionOrWarn } from '@/features/reminders/permission';
import { EXPO_GO_NOTICE, notificationsSupported } from '@/features/reminders/reminders';
import { confirmDelete } from '@/lib/alerts';
import { addDays, formatDayShort, type DateKey } from '@/lib/dates';
import { parseWholeNumber } from '@/lib/format';
import { useEditRecord } from '@/lib/use-edit-record';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Form = { name: string; icon: string; interval: string; nextDue: DateKey; remind: boolean; note: string };

/** Nowy obowiązek: /dom/obowiazek/nowy, edycja: /dom/obowiazek/2. */
export default function ChoreEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowy';
  const choreId = Number(id);

  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();
  const [form, setForm] = useState<Form>({ name: '', icon: HOME_ICONS[0], interval: '30', nextDue: today, remind: true, note: '' });
  const [lastDone, setLastDone] = useState<DateKey | null>(null);

  const loaded = useEditRecord(isNew ? null : choreId, () => getChore(db, choreId), (chore) => {
    setForm({
      name: chore.name,
      icon: chore.icon,
      interval: String(chore.interval_days),
      nextDue: chore.next_due,
      remind: chore.remind === 1,
      note: chore.note,
    });
    setLastDone(chore.last_done);
  });

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const interval = parseWholeNumber(form.interval) ?? 0;
  const canSave = loaded && form.name.trim().length > 0 && interval > 0 && interval <= 3650;

  const toggleRemind = () => {
    if (!form.remind) {
      void requestPermissionOrWarn('Obowiązek zostanie zapisany, ale przypomnienie nie przyjdzie bez zgody na powiadomienia.');
    }
    update({ remind: !form.remind });
  };

  const save = async () => {
    if (!canSave) return;
    const input = {
      name: form.name.trim(),
      icon: form.icon,
      interval_days: interval,
      next_due: form.nextDue,
      remind: form.remind,
      note: form.note.trim(),
    };
    if (isNew) await createChore(db, input);
    else await updateChore(db, choreId, input);
    router.back();
  };

  const remove = () =>
    confirmDelete('Usunąć obowiązek?', form.name, async () => {
      await deleteChore(db, choreId);
      router.back();
    });

  return (
    <ScrollScreen
      title={isNew ? 'Nowy obowiązek' : 'Obowiązek'}
      headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
      {loaded ? (
        <>
          <TextField
            label="Nazwa"
            value={form.name}
            onChangeText={(name) => update({ name })}
            placeholder="np. Wymiana filtra, Odkamienianie czajnika"
            autoFocus={isNew}
            maxLength={50}
          />

          <Section title="Jak często">
            <ChipRow>
              {CHORE_INTERVALS.map((option) => (
                <Chip
                  key={option.days}
                  label={option.label}
                  selected={interval === option.days}
                  onPress={() => update({ interval: String(option.days) })}
                />
              ))}
            </ChipRow>
            <View style={styles.row}>
              <AppText tone="textSecondary">Co</AppText>
              <View style={styles.flex}>
                <TextField
                  value={form.interval}
                  onChangeText={(text) => update({ interval: text.replace(/\D/g, '') })}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
              <AppText tone="textSecondary">dni</AppText>
            </View>
          </Section>

          <Section title="Najbliższy termin">
            <DateChoice
              value={form.nextDue}
              onChange={(date) => date && update({ nextDue: date })}
              today={today}
              pickerTitle="Najbliższy termin"
              presets={[
                { label: 'Dziś', date: today },
                ...(interval > 0 ? [{ label: `Za ${interval} dni`, date: addDays(today, interval) }] : []),
              ]}
            />
            {lastDone ? (
              <AppText variant="caption" tone="textMuted">
                Ostatnio zrobione: {formatDayShort(lastDone, today)}
              </AppText>
            ) : null}
          </Section>

          <Section title="Przypomnienie">
            <ChipRow>
              <Chip
                label={form.remind ? 'W dniu terminu o 9:00' : 'Bez przypomnienia'}
                icon={form.remind ? 'notifications' : 'notifications_off'}
                selected={form.remind}
                onPress={toggleRemind}
              />
            </ChipRow>
            {form.remind && !notificationsSupported ? (
              <AppText variant="caption" tone="textMuted">
                {EXPO_GO_NOTICE}
              </AppText>
            ) : null}
          </Section>

          <Section title="Ikona">
            <EmojiPicker options={HOME_ICONS} value={form.icon} onChange={(icon) => update({ icon })} color={colors.notes} />
          </Section>

          <TextField label="Notatka" value={form.note} onChangeText={(note) => update({ note })} placeholder="np. model filtra" multiline />

          {!isNew ? <Button label="Usuń obowiązek" variant="danger" icon="delete" onPress={remove} /> : null}
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
