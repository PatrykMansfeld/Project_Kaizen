import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { TextField } from '@/components/text-field';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import { createHabit, deleteHabit, getHabit, setHabitArchived, updateHabit, type HabitInput } from '@/db/habits';
import { UNIT_SUGGESTIONS } from '@/features/habits/amount';
import { HabitIcon } from '@/features/habits/habit-card';
import { HABIT_ICONS } from '@/features/habits/icons';
import { notificationsSupported, requestPermission } from '@/features/reminders/reminders';
import { EVERY_DAY } from '@/features/habits/streak';
import { WEEKDAYS_SHORT } from '@/lib/dates';
import { PALETTE, PALETTE_KEYS, paletteColor } from '@/theme/palette';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const TARGETS = [1, 2, 3, 4, 5];

/** Nowy nawyk: /nawyk/nowy, edycja: /nawyk/123. */
export default function HabitEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowy';
  const habitId = Number(id);

  const db = useSQLiteContext();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<HabitInput>({
    name: '',
    icon: HABIT_ICONS[0],
    color: PALETTE_KEYS[0],
    target_per_day: 1,
    unit: null,
    reminder_time: null,
    days_mask: EVERY_DAY,
  });
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

  const setReminder = async (time: string) => {
    update({ reminder_time: time });
    const permission = await requestPermission();
    if (permission === 'denied') {
      Alert.alert(
        'Powiadomienia są zablokowane',
        'Przypomnienie zostanie zapisane, ale nie dostaniesz go, dopóki nie włączysz powiadomień w ustawieniach telefonu.',
        [
          { text: 'Później', style: 'cancel' },
          { text: 'Otwórz ustawienia', onPress: () => Linking.openSettings() },
        ],
      );
    }
    // 'unavailable' (Expo Go): godzina się zapisuje, a informacja jest pod sekcją przypomnienia.
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

  const confirmDelete = () => {
    Alert.alert('Usunąć nawyk?', 'Cała historia odhaczeń tego nawyku też zostanie usunięta. Jeśli chcesz ją zachować, zarchiwizuj nawyk.', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          await deleteHabit(db, habitId);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'Nowy nawyk' : 'Nawyk',
          headerRight: () => (
            <Pressable onPress={save} disabled={!canSave} hitSlop={8} accessibilityRole="button">
              <AppText variant="bodyStrong" tone={canSave ? 'accent' : 'textMuted'}>
                Zapisz
              </AppText>
            </Pressable>
          ),
        }}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
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

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Cel dzienny
              </AppText>
              <View style={styles.row}>
                <Chip label="Licznik (1–5×)" selected={!isAmount} onPress={() => setGoalType(false)} />
                <Chip label="Ilość" selected={isAmount} onPress={() => setGoalType(true)} />
              </View>
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
                  <View style={styles.row}>
                    {UNIT_SUGGESTIONS.map((unit) => (
                      <Chip key={unit} label={unit} selected={form.unit === unit} onPress={() => update({ unit })} />
                    ))}
                  </View>
                  <AppText variant="caption" tone="textMuted">
                    Stuknięcie w nawyk otworzy okienko, w którym dodasz ilość (np. +500 kroków).
                  </AppText>
                </>
              ) : (
                <View style={styles.row}>
                  {TARGETS.map((target) => (
                    <Chip
                      key={target}
                      label={`${target}×`}
                      selected={form.target_per_day === target}
                      onPress={() => update({ target_per_day: target })}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Dni tygodnia
              </AppText>
              <View style={styles.row}>
                {WEEKDAYS_SHORT.map((name, index) => (
                  <Chip
                    key={name}
                    label={name}
                    selected={((form.days_mask >> index) & 1) === 1}
                    onPress={() => toggleDay(index)}
                  />
                ))}
              </View>
              <View style={styles.row}>
                <Chip label="Codziennie" selected={form.days_mask === EVERY_DAY} onPress={() => update({ days_mask: EVERY_DAY })} />
                <Chip label="Dni robocze" selected={form.days_mask === 0b0011111} onPress={() => update({ days_mask: 0b0011111 })} />
              </View>
              {form.days_mask !== EVERY_DAY ? (
                <AppText variant="caption" tone="textMuted">
                  Pozostałe dni nie przerywają serii, a przypomnienia przychodzą tylko w wybrane dni.
                </AppText>
              ) : null}
            </View>

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Przypomnienie
              </AppText>
              <View style={styles.row}>
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
              </View>
              {form.reminder_time ? (
                <AppText variant="caption" tone="textMuted">
                  {notificationsSupported
                    ? 'Jeśli wykonasz nawyk wcześniej, tego dnia przypomnienie się nie pojawi.'
                    : 'W Expo Go powiadomienia nie działają — przypomnienie zacznie przychodzić po zainstalowaniu aplikacji (APK).'}
                </AppText>
              ) : null}
            </View>

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Kolor
              </AppText>
              <View style={styles.row}>
                {PALETTE_KEYS.map((key) => {
                  const selected = form.color === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => update({ color: key })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={PALETTE[key].label}
                      style={[styles.swatch, { backgroundColor: paletteColor(key, dark) }]}>
                      {selected ? <Icon name="check" size={20} color="#FFFFFF" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Ikona
              </AppText>
              <View style={styles.iconGrid}>
                {HABIT_ICONS.map((icon) => {
                  const selected = form.icon === icon;
                  return (
                    <Pressable
                      key={icon}
                      onPress={() => update({ icon })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[
                        styles.iconOption,
                        { backgroundColor: selected ? withAlpha(color, 0.25) : colors.surface },
                        selected && { borderColor: color },
                      ]}>
                      <Text style={styles.emoji}>{icon}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {!isNew ? (
              <View style={styles.section}>
                <Button
                  label={archived ? 'Przywróć z archiwum' : 'Archiwizuj'}
                  variant="secondary"
                  icon={archived ? 'unarchive' : 'archive'}
                  onPress={toggleArchived}
                />
                <Button label="Usuń nawyk" variant="danger" icon="delete" onPress={confirmDelete} />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

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
  content: { gap: spacing.xl, padding: spacing.lg },
  preview: { alignItems: 'center' },
  amountRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
});
