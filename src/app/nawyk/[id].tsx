import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { ColorSwatches } from '@/components/color-swatches';
import { EmojiPicker } from '@/components/emoji-picker';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import { createHabit, deleteHabit, getHabit, setHabitArchived, updateHabit, type HabitInput } from '@/db/habits';
import { UNIT_SUGGESTIONS } from '@/features/habits/amount';
import { HabitIcon } from '@/features/habits/habit-card';
import { HABIT_ICONS } from '@/features/habits/icons';
import { EVERY_DAY, WORKDAYS } from '@/features/habits/streak';
import { useModuleVisible } from '@/features/modules/preferences';
import { ATTRIBUTES, ATTRIBUTE_KEYS, guessAttribute } from '@/features/progress/xp';
import { requestPermissionOrWarn } from '@/features/reminders/permission';
import { EXPO_GO_NOTICE, notificationsSupported } from '@/features/reminders/reminders';
import { confirmDelete } from '@/lib/alerts';
import { WEEKDAYS_SHORT } from '@/lib/dates';
import { PALETTE, PALETTE_KEYS, paletteColor, type PaletteKey } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const TARGETS = [1, 2, 3, 4, 5];
const WEEKLY_TARGETS = [1, 2, 3, 4, 5, 6];

/** Nowy nawyk: /nawyk/nowy, edycja: /nawyk/123. */
export default function HabitEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowy';
  const habitId = Number(id);

  const db = useSQLiteContext();
  const { dark } = useTheme();

  const [form, setForm] = useState<HabitInput>({
    name: '',
    icon: HABIT_ICONS[0],
    color: PALETTE_KEYS[0],
    target_per_day: 1,
    unit: null,
    reminder_time: null,
    days_mask: EVERY_DAY,
    weekly_target: null,
    attribute: guessAttribute(HABIT_ICONS[0]),
  });
  // Nowy nawyk dostaje cechę po ikonie, dopóki nie wybierzesz jej sam.
  const [attributeChosen, setAttributeChosen] = useState(!isNew);
  const progressVisible = useModuleVisible('postep');
  // Cel nawyku ilościowego jako tekst z pola (np. „10000”).
  const [amountText, setAmountText] = useState('');
  const [archived, setArchived] = useState(false);
  const [loaded, setLoaded] = useState(isNew);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getHabit(db, habitId).then((habit) => {
      if (!habit) {
        router.back();
        return;
      }
      setForm({
        name: habit.name,
        icon: habit.icon,
        color: habit.color,
        target_per_day: habit.target_per_day,
        unit: habit.unit,
        reminder_time: habit.reminder_time,
        days_mask: habit.days_mask,
        weekly_target: habit.weekly_target,
        attribute: habit.attribute,
      });
      if (habit.unit) setAmountText(String(habit.target_per_day));
      setArchived(habit.archived === 1);
      setLoaded(true);
    });
  }, [db, isNew, habitId]);

  const update = (patch: Partial<HabitInput>) => setForm((current) => ({ ...current, ...patch }));
  const isAmount = form.unit !== null;
  const amountTarget = /^\d+$/.test(amountText) ? Number(amountText) : 0;
  const amountValid = !isAmount || (amountTarget >= 1 && amountTarget <= 1_000_000 && form.unit!.trim().length > 0);
  const canSave = loaded && form.name.trim().length > 0 && amountValid;

  // Licznik ↔ ilość. Licznik ma cel 1–5, więc przy powrocie z ilości przycinamy go.
  const setGoalType = (amount: boolean) =>
    update(
      amount
        ? { unit: form.unit ?? '' }
        : { unit: null, target_per_day: Math.min(Math.max(form.target_per_day, 1), 5) },
    );
  const color = paletteColor(form.color, dark);

  const save = async () => {
    if (!canSave) return;
    const input = isAmount
      ? { ...form, name: form.name.trim(), unit: form.unit!.trim(), target_per_day: amountTarget }
      : { ...form, name: form.name.trim() };
    if (isNew) {
      await createHabit(db, input);
    } else {
      await updateHabit(db, habitId, input);
    }
    router.back();
  };

  const setReminder = (time: string) => {
    update({ reminder_time: time });
    void requestPermissionOrWarn(
      'Przypomnienie zostanie zapisane, ale nie dostaniesz go, dopóki nie włączysz powiadomień w ustawieniach telefonu.',
    );
  };

  // Ostatniego dnia nie da się odznaczyć — nawyk musi mieć przynajmniej jeden dzień.
  const toggleDay = (index: number) => {
    const mask = form.days_mask ^ (1 << index);
    if (mask !== 0) update({ days_mask: mask });
  };

  const toggleArchived = async () => {
    await setHabitArchived(db, habitId, !archived);
    router.back();
  };

  const remove = () =>
    confirmDelete(
      'Usunąć nawyk?',
      'Cała historia odhaczeń tego nawyku też zostanie usunięta. Jeśli chcesz ją zachować, zarchiwizuj nawyk.',
      async () => {
        await deleteHabit(db, habitId);
        router.back();
      },
    );

  return (
    <>
      <ScrollScreen
        title={isNew ? 'Nowy nawyk' : 'Nawyk'}
        headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
        {loaded ? (
          <>
            <View style={styles.preview}>
              <HabitIcon icon={form.icon} color={color} size={72} />
            </View>

            <TextField
              label="Nazwa"
              value={form.name}
              onChangeText={(name) => update({ name })}
              placeholder="np. Szklanka wody"
              autoFocus={isNew}
              returnKeyType="done"
            />

            <Section title="Cel dzienny">
              <ChipRow>
                <Chip label="Licznik (1–5×)" selected={!isAmount} onPress={() => setGoalType(false)} />
                <Chip label="Ilość" selected={isAmount} onPress={() => setGoalType(true)} />
              </ChipRow>
              {isAmount ? (
                <>
                  <View style={styles.amountRow}>
                    <View style={styles.flex}>
                      <TextField
                        value={amountText}
                        onChangeText={(text) => setAmountText(text.replace(/\D/g, ''))}
                        placeholder="np. 10000"
                        keyboardType="number-pad"
                        maxLength={7}
                      />
                    </View>
                    <View style={styles.flex}>
                      <TextField
                        value={form.unit ?? ''}
                        onChangeText={(unit) => update({ unit })}
                        placeholder="jednostka"
                        autoCapitalize="none"
                        maxLength={16}
                      />
                    </View>
                  </View>
                  <ChipRow>
                    {UNIT_SUGGESTIONS.map((unit) => (
                      <Chip key={unit} label={unit} selected={form.unit === unit} onPress={() => update({ unit })} />
                    ))}
                  </ChipRow>
                  <AppText variant="caption" tone="textMuted">
                    Stuknięcie w nawyk otworzy okienko, w którym dodasz ilość (np. +500 kroków).
                  </AppText>
                </>
              ) : (
                <ChipRow>
                  {TARGETS.map((target) => (
                    <Chip
                      key={target}
                      label={`${target}×`}
                      selected={form.target_per_day === target}
                      onPress={() => update({ target_per_day: target })}
                    />
                  ))}
                </ChipRow>
              )}
            </Section>

            <Section title="Kiedy">
              <ChipRow>
                <Chip
                  label="W wybrane dni"
                  selected={form.weekly_target === null}
                  onPress={() => update({ weekly_target: null })}
                />
                <Chip
                  label="X razy w tygodniu"
                  selected={form.weekly_target !== null}
                  onPress={() => update({ weekly_target: form.weekly_target ?? 3 })}
                />
              </ChipRow>
              {form.weekly_target !== null ? (
                <>
                  <ChipRow>
                    {WEEKLY_TARGETS.map((times) => (
                      <Chip
                        key={times}
                        label={`${times}× w tyg.`}
                        selected={form.weekly_target === times}
                        onPress={() => update({ weekly_target: times })}
                      />
                    ))}
                  </ChipRow>
                  <AppText variant="caption" tone="textMuted">
                    Dowolne dni tygodnia — seria liczy kolejne tygodnie z osiągniętym celem.
                  </AppText>
                </>
              ) : (
                <>
                  <ChipRow>
                    {WEEKDAYS_SHORT.map((name, index) => (
                      <Chip
                        key={name}
                        label={name}
                        selected={((form.days_mask >> index) & 1) === 1}
                        onPress={() => toggleDay(index)}
                      />
                    ))}
                  </ChipRow>
                  <ChipRow>
                    <Chip label="Codziennie" selected={form.days_mask === EVERY_DAY} onPress={() => update({ days_mask: EVERY_DAY })} />
                    <Chip label="Dni robocze" selected={form.days_mask === WORKDAYS} onPress={() => update({ days_mask: WORKDAYS })} />
                  </ChipRow>
                  {form.days_mask !== EVERY_DAY ? (
                    <AppText variant="caption" tone="textMuted">
                      Pozostałe dni nie przerywają serii, a przypomnienia przychodzą tylko w wybrane dni.
                    </AppText>
                  ) : null}
                </>
              )}
            </Section>

            <Section title="Przypomnienie">
              <ChipRow>
                <Chip
                  label="Wyłączone"
                  selected={form.reminder_time === null}
                  onPress={() => update({ reminder_time: null })}
                />
                <Chip
                  label={form.reminder_time ? `Godzina ${form.reminder_time}` : 'Ustaw godzinę'}
                  icon="notifications"
                  selected={form.reminder_time !== null}
                  onPress={() => setTimePickerOpen(true)}
                />
              </ChipRow>
              {form.reminder_time ? (
                <AppText variant="caption" tone="textMuted">
                  {notificationsSupported
                    ? 'Jeśli wykonasz nawyk wcześniej, tego dnia przypomnienie się nie pojawi.'
                    : EXPO_GO_NOTICE}
                </AppText>
              ) : null}
            </Section>

            <Section title="Kolor">
              <ColorSwatches
                swatches={PALETTE_KEYS.map((key) => ({ key, label: PALETTE[key].label, color: paletteColor(key, dark) }))}
                value={form.color as PaletteKey}
                onChange={(key) => update({ color: key })}
                checkColor="#FFFFFF"
              />
            </Section>

            <Section title="Ikona">
              <EmojiPicker
                options={HABIT_ICONS}
                value={form.icon}
                onChange={(icon) => update(attributeChosen ? { icon } : { icon, attribute: guessAttribute(icon) })}
                color={color}
              />
            </Section>

            {progressVisible ? (
              <Section title="Cecha">
                <ChipRow>
                  {ATTRIBUTE_KEYS.map((key) => (
                    <Chip
                      key={key}
                      label={ATTRIBUTES[key].label}
                      selected={form.attribute === key}
                      onPress={() => {
                        setAttributeChosen(true);
                        update({ attribute: key });
                      }}
                    />
                  ))}
                </ChipRow>
                <AppText variant="caption" tone="textMuted">
                  Każde odhaczenie daje 10 XP tej cesze w Postępie.
                </AppText>
              </Section>
            ) : null}

            {!isNew ? (
              <View style={styles.dangerZone}>
                <Button
                  label={archived ? 'Przywróć z archiwum' : 'Archiwizuj'}
                  variant="secondary"
                  icon={archived ? 'unarchive' : 'archive'}
                  onPress={toggleArchived}
                />
                <Button label="Usuń nawyk" variant="danger" icon="delete" onPress={remove} />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollScreen>

      <TimePickerSheet
        visible={timePickerOpen}
        title="Przypomnienie"
        value={form.reminder_time}
        onChange={setReminder}
        onClose={() => setTimePickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center' },
  amountRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  dangerZone: { gap: spacing.sm },
});
