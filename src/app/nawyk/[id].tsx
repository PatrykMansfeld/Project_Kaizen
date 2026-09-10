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
import { createHabit, deleteHabit, getHabit, updateHabit, type HabitInput } from '@/db/habits';
import { HabitIcon } from '@/features/habits/habit-card';
import { HABIT_COLORS, HABIT_COLOR_KEYS, HABIT_ICONS, habitColor } from '@/features/habits/palette';
import { requestPermission } from '@/features/habits/reminders';
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
    color: HABIT_COLOR_KEYS[0],
    target_per_day: 1,
    reminder_time: null,
  });
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
        reminder_time: habit.reminder_time,
      });
      setLoaded(true);
    });
  }, [db, isNew, habitId]);

  const update = (patch: Partial<HabitInput>) => setForm((current) => ({ ...current, ...patch }));
  const canSave = loaded && form.name.trim().length > 0;
  const color = habitColor(form.color, dark);

  const save = async () => {
    if (!canSave) return;
    const input = { ...form, name: form.name.trim() };
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
    } else if (permission === 'unavailable') {
      Alert.alert('Powiadomienia niedostępne', 'Ta wersja aplikacji nie obsługuje powiadomień.');
    }
  };

  const confirmDelete = () => {
    Alert.alert('Usunąć nawyk?', 'Cała historia odhaczeń tego nawyku też zostanie usunięta.', [
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
                {TARGETS.map((target) => (
                  <Chip
                    key={target}
                    label={`${target}×`}
                    selected={form.target_per_day === target}
                    onPress={() => update({ target_per_day: target })}
                  />
                ))}
              </View>
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
                  label={form.reminder_time ? `Codziennie o ${form.reminder_time}` : 'Ustaw godzinę'}
                  icon="notifications"
                  selected={form.reminder_time !== null}
                  onPress={() => setTimePickerOpen(true)}
                />
              </View>
              {form.reminder_time ? (
                <AppText variant="caption" tone="textMuted">
                  Jeśli wykonasz nawyk wcześniej, tego dnia przypomnienie się nie pojawi.
                </AppText>
              ) : null}
            </View>

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Kolor
              </AppText>
              <View style={styles.row}>
                {HABIT_COLOR_KEYS.map((key) => {
                  const selected = form.color === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => update({ color: key })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={HABIT_COLORS[key].label}
                      style={[styles.swatch, { backgroundColor: habitColor(key, dark) }]}>
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
              <Button label="Usuń nawyk" variant="danger" icon="delete" onPress={confirmDelete} />
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
