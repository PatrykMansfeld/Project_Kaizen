import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import type { Habit } from '@/db/habits';
import { Meter } from '@/features/stats/charts';
import { formatDayLong, relativeDayLabel, type DateKey } from '@/lib/dates';
import { paletteColor } from '@/theme/palette';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { formatAmount, quickSteps } from './amount';

export type AmountTarget = { habit: Habit; date: DateKey; count: number };

type Props = {
  target: AmountTarget | null;
  today: DateKey;
  onSave: (target: AmountTarget, count: number) => void;
  onClose: () => void;
};

/** Okienko nawyku ilościowego: szybkie „+”, dokładna wartość, zerowanie. */
export function AmountSheet({ target, today, onSave, onClose }: Props) {
  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      {target ? <SheetContent target={target} today={today} onSave={onSave} onClose={onClose} /> : null}
    </Modal>
  );
}

function SheetContent({ target, today, onSave, onClose }: Props & { target: AmountTarget }) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { habit, date } = target;
  const [value, setValue] = useState(target.count);
  const [text, setText] = useState(target.count ? String(target.count) : '');
  const color = paletteColor(habit.color, dark);

  const set = (next: number) => {
    const clamped = Math.max(0, Math.min(next, 10_000_000));
    setValue(clamped);
    setText(clamped ? String(clamped) : '');
  };

  const save = () => {
    onSave(target, value);
    onClose();
  };

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Zamknij" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
        <View>
          <AppText variant="heading">
            {habit.icon} {habit.name}
          </AppText>
          <AppText variant="caption" tone="textSecondary">
            {relativeDayLabel(date, today) ?? formatDayLong(date)}
          </AppText>
        </View>

        <View style={styles.progress}>
          <AppText variant="title">{formatAmount(value)}</AppText>
          <AppText tone="textSecondary">
            z {formatAmount(habit.target_per_day)} {habit.unit}
          </AppText>
        </View>
        <Meter value={value / habit.target_per_day} color={color} />

        <View style={styles.row}>
          {quickSteps(habit.target_per_day).map((step) => (
            <Chip key={step} label={`+${formatAmount(step)}`} selected={false} onPress={() => set(value + step)} />
          ))}
          <Chip label="Cel" icon="check" selected={value >= habit.target_per_day} onPress={() => set(habit.target_per_day)} />
        </View>

        <View style={styles.row}>
          <TextInput
            value={text}
            onChangeText={(input) => {
              const digits = input.replace(/\D/g, '');
              setText(digits);
              setValue(digits ? Number(digits) : 0);
            }}
            placeholder="Dokładna wartość"
            placeholderTextColor={colors.textMuted}
            cursorColor={colors.accent}
            keyboardType="number-pad"
            maxLength={8}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <Chip label="Wyzeruj" selected={false} onPress={() => set(0)} />
        </View>

        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button label="Anuluj" variant="secondary" onPress={onClose} />
          </View>
          <View style={styles.flex}>
            <Button label="Zapisz" onPress={save} />
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  progress: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, height: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  actions: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
