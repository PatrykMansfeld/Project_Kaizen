import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { DateChoice, recentDayPresets } from '@/components/date-choice';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
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
import { confirmDelete } from '@/lib/alerts';
import { type DateKey } from '@/lib/dates';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { useEditRecord } from '@/lib/use-edit-record';
import { useToday } from '@/lib/use-today';

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

  const [type, setType] = useState<MeasurementType>(isMeasurementType(params.type) ? params.type : 'weight');
  const [date, setDate] = useState<DateKey>(today);
  const [valueText, setValueText] = useState('');
  const [lastValue, setLastValue] = useState<number | null>(null);

  const loaded = useEditRecord(isNew ? null : measurementId, () => getMeasurement(db, measurementId), (measurement) => {
    setType(measurement.type);
    setDate(measurement.date);
    setValueText(formatDecimal(measurement.value, 2));
  });

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

  const remove = () =>
    confirmDelete('Usunąć pomiar?', undefined, async () => {
      await deleteMeasurement(db, measurementId);
      router.back();
    });

  return (
    <ScrollScreen
      title={isNew ? 'Nowy pomiar' : 'Pomiar'}
      headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
      {loaded ? (
        <>
          <Section title="Rodzaj">
            <ChipRow>
              {MEASUREMENT_TYPE_KEYS.map((key) => (
                <Chip key={key} label={MEASUREMENT_TYPES[key].label} selected={type === key} onPress={() => setType(key)} />
              ))}
            </ChipRow>
          </Section>

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

          <Section title="Data">
            <DateChoice
              value={date}
              onChange={(day) => day && setDate(day)}
              today={today}
              pickerTitle="Data pomiaru"
              presets={recentDayPresets(today)}
            />
          </Section>

          {!isNew ? <Button label="Usuń pomiar" variant="danger" icon="delete" onPress={remove} /> : null}
        </>
      ) : null}
    </ScrollScreen>
  );
}
