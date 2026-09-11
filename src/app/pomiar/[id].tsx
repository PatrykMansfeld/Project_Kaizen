import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DatePickerSheet } from '@/components/date-picker-sheet';
import { TextField } from '@/components/text-field';
import {
  MEASUREMENT_TYPES,
  MEASUREMENT_TYPE_KEYS,
  createMeasurement,
  deleteMeasurement,
  getLatestMeasurement,
  getMeasurement,
  updateMeasurement,
  type MeasurementType,
} from '@/db/measurements';
import { addDays, formatDayShort, type DateKey } from '@/lib/dates';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

function isMeasurementType(value: unknown): value is MeasurementType {
  return typeof value === 'string' && value in MEASUREMENT_TYPES;
}

/** Nowy pomiar: /pomiar/nowy?type=weight, edycja: /pomiar/123. */
export default function MeasurementEditScreen() {
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const isNew = params.id === 'nowy';
  const measurementId = Number(params.id);

  const db = useSQLiteContext();
  const today = useToday();
  const yesterday = addDays(today, -1);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<MeasurementType>(isMeasurementType(params.type) ? params.type : 'weight');
  const [date, setDate] = useState<DateKey>(today);
  const [valueText, setValueText] = useState('');
  const [lastValue, setLastValue] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getMeasurement(db, measurementId).then((measurement) => {
      if (!measurement) {
        router.back();
        return;
      }
      setType(measurement.type);
      setDate(measurement.date);
      setValueText(formatDecimal(measurement.value, 2));
      setLoaded(true);
    });
  }, [db, isNew, measurementId]);

  // Podpowiedź z ostatniego pomiaru tego rodzaju.
  useEffect(() => {
    if (!isNew) return;
    getLatestMeasurement(db, type).then((latest) => setLastValue(latest?.value ?? null));
  }, [db, isNew, type]);

  const { unit } = MEASUREMENT_TYPES[type];
  const value = parseDecimal(valueText);
  const valid = value !== null && value > 0 && value < 1000;
  const canSave = loaded && valid;

  const save = async () => {
    if (!canSave || value === null) return;
    const input = { type, date, value };
    if (isNew) {
      await createMeasurement(db, input);
    } else {
      await updateMeasurement(db, measurementId, input);
    }
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert('Usunąć pomiar?', undefined, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          await deleteMeasurement(db, measurementId);
          router.back();
        },
      },
    ]);
  };

  const customDate = date !== today && date !== yesterday;

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'Nowy pomiar' : 'Pomiar',
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
            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Rodzaj
              </AppText>
              <View style={styles.chips}>
                {MEASUREMENT_TYPE_KEYS.map((key) => (
                  <Chip key={key} label={MEASUREMENT_TYPES[key].label} selected={type === key} onPress={() => setType(key)} />
                ))}
              </View>
            </View>

            <TextField
              label={`Wartość (${unit})`}
              value={valueText}
              onChangeText={setValueText}
              placeholder={lastValue !== null ? `ostatnio ${formatDecimal(lastValue, 1)}` : 'np. 82,4'}
              keyboardType="decimal-pad"
              maxLength={6}
              autoFocus={isNew}
            />
            {valueText && !valid ? (
              <AppText variant="caption" tone="danger">
                Wpisz liczbę, np. 82,4
              </AppText>
            ) : null}

            <View style={styles.section}>
              <AppText variant="label" tone="textSecondary">
                Data
              </AppText>
              <View style={styles.chips}>
                <Chip label="Dziś" selected={date === today} onPress={() => setDate(today)} />
                <Chip label="Wczoraj" selected={date === yesterday} onPress={() => setDate(yesterday)} />
                <Chip
                  label={customDate ? formatDayShort(date, today) : 'Inna data'}
                  icon="calendar_month"
                  selected={customDate}
                  onPress={() => setPickerOpen(true)}
                />
              </View>
            </View>

            {!isNew ? <Button label="Usuń pomiar" variant="danger" icon="delete" onPress={confirmDelete} /> : null}
          </>
        ) : null}
      </ScrollView>
      <DatePickerSheet
        visible={pickerOpen}
        title="Data pomiaru"
        today={today}
        value={date}
        onChange={(day) => day && setDate(day)}
        onClose={() => setPickerOpen(false)}
        clearable={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, padding: spacing.lg },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
