import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);

type Props = {
  visible: boolean;
  title: string;
  /** 'HH:MM' */
  value: string | null;
  onChange: (time: string) => void;
  onClose: () => void;
};

const pad = (value: number) => String(value).padStart(2, '0');

/** Wybór godziny (co 5 minut), wysuwany od dołu. */
export function TimePickerSheet({ visible, onClose, ...rest }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} gap={spacing.md}>
      <SheetContent onClose={onClose} {...rest} />
    </BottomSheet>
  );
}

function SheetContent({ title, value, onChange, onClose }: Omit<Props, 'visible'>) {
  const [initialHour, initialMinute] = (value ?? '20:00').split(':').map(Number);
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute - (initialMinute % 5));

  return (
    <>
      <View style={styles.titleRow}>
        <AppText variant="heading" style={styles.flex}>
          {title}
        </AppText>
        <AppText variant="heading" tone="accent">
          {pad(hour)}:{pad(minute)}
        </AppText>
      </View>

      <AppText variant="label" tone="textSecondary">
        Godzina
      </AppText>
      <Grid values={HOURS} selected={hour} onSelect={setHour} format={String} />

      <AppText variant="label" tone="textSecondary">
        Minuty
      </AppText>
      <Grid values={MINUTES} selected={minute} onSelect={setMinute} format={pad} />

      <View style={styles.actions}>
        <SheetActions>
          <Button label="Anuluj" variant="secondary" onPress={onClose} />
          <Button
            label="Gotowe"
            onPress={() => {
              onChange(`${pad(hour)}:${pad(minute)}`);
              onClose();
            }}
          />
        </SheetActions>
      </View>
    </>
  );
}

type GridProps = {
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
  format: (value: number) => string;
};

function Grid({ values, selected, onSelect, format }: GridProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {values.map((value) => {
        const isSelected = value === selected;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={[styles.cell, { backgroundColor: isSelected ? colors.accent : colors.surfaceAlt }]}>
            <AppText style={{ color: isSelected ? colors.onAccent : colors.text, fontWeight: isSelected ? '700' : '400' }}>
              {format(value)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  // 6 kolumn: (100% − 5 odstępów) / 6
  cell: {
    width: '15.5%',
    flexGrow: 1,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { marginTop: spacing.sm },
});
