import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions } from '@/components/bottom-sheet';
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
    <BottomSheet visible={target !== null} onClose={onClose}>
      {target ? <SheetContent target={target} today={today} onSave={onSave} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function SheetContent({ target, today, onSave, onClose }: Props & { target: AmountTarget }) {
  const { colors, dark } = useTheme();
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

      <SheetActions>
        <Button label="Anuluj" variant="secondary" onPress={onClose} />
        <Button label="Zapisz" onPress={save} />
      </SheetActions>
    </>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, height: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 },
});
