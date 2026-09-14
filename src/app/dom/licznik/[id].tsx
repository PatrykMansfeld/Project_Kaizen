import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions } from '@/components/bottom-sheet';
import { Button, IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { DateChoice, recentDayPresets } from '@/components/date-choice';
import { EmptyLine } from '@/components/empty-state';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { METER_READINGS_SQL, METER_SQL, addReading, deleteReading, type Meter, type MeterReading } from '@/db/home';
import { useQuery } from '@/db/use-query';
import { formatUsage, readingDeltas } from '@/features/home/home';
import { LineChart } from '@/features/stats/line-chart';
import { confirmDelete } from '@/lib/alerts';
import { diffDays, formatDayRelative, type DateKey } from '@/lib/dates';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { useTheme } from '@/theme/use-theme';

/** Licznik: odczyty, zużycie między nimi i wykres (/dom/licznik/2). */
export default function MeterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const meterId = Number(id);
  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const { rows: meterRows, loaded } = useQuery<Meter>(METER_SQL, { $id: meterId }, ['meters']);
  const { rows: readings } = useQuery<MeterReading>(METER_READINGS_SQL, { $meter: meterId }, ['meter_readings']);
  const meter = meterRows[0];
  const deltas = readingDeltas(readings);
  const usageById = new Map(deltas.map((delta) => [delta.reading.id, delta.usage]));
  const chronological = [...readings].reverse();
  const selectedReading = readings.find((reading) => String(reading.id) === selected);

  useEffect(() => {
    if (loaded && !meter) router.back();
  }, [loaded, meter]);

  const remove = (reading: MeterReading) =>
    confirmDelete('Usunąć odczyt?', `${formatDecimal(reading.value, 2)} ${meter?.unit ?? ''}`, () => deleteReading(db, reading.id));

  return (
    <>
      <ScrollScreen
        title={meter ? `${meter.icon} ${meter.name}` : 'Licznik'}
        headerRight={
          <IconButton
            icon="edit"
            accessibilityLabel="Edytuj licznik"
            onPress={() => router.push({ pathname: '/dom/licznik/edycja/[id]', params: { id: String(meterId) } })}
          />
        }>
        <Button label="Dodaj odczyt" icon="add" onPress={() => setAdding(true)} />

        {chronological.length > 1 ? (
          <Card>
            <AppText variant="caption" tone="textSecondary">
              {selectedReading
                ? `${formatDayRelative(selectedReading.date, today)}: ${formatDecimal(selectedReading.value, 2)} ${meter?.unit}`
                : 'Stan licznika — stuknij wykres, żeby zobaczyć odczyt'}
            </AppText>
            <LineChart
              points={chronological.map((reading) => ({
                key: String(reading.id),
                x: diffDays(chronological[0].date, reading.date),
                y: reading.value,
              }))}
              color={colors.notes}
              selectedKey={selected}
              onSelect={setSelected}
            />
          </Card>
        ) : null}

        <Section title="Odczyty">
          {readings.length === 0 ? <EmptyLine text="Brak odczytów — dodaj pierwszy." /> : null}
          {readings.map((reading) => {
            const usage = usageById.get(reading.id);
            return (
              <Card key={reading.id} variant="row" onPress={() => remove(reading)} accessibilityLabel="Stuknij, żeby usunąć odczyt">
                <View style={styles.flex}>
                  <AppText>{formatDayRelative(reading.date, today)}</AppText>
                  {usage && meter ? (
                    <AppText variant="caption" tone="textSecondary">
                      {formatUsage(usage, meter.unit)}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="bodyStrong">
                  {formatDecimal(reading.value, 2)} {meter?.unit}
                </AppText>
              </Card>
            );
          })}
        </Section>
      </ScrollScreen>
      <ReadingSheet
        visible={adding}
        unit={meter?.unit ?? ''}
        lastValue={readings[0]?.value ?? null}
        today={today}
        onSave={(date, value) => addReading(db, meterId, date, value)}
        onClose={() => setAdding(false)}
      />
    </>
  );
}

type ReadingSheetProps = {
  visible: boolean;
  unit: string;
  lastValue: number | null;
  today: DateKey;
  onSave: (date: DateKey, value: number) => void;
  onClose: () => void;
};

function ReadingSheet({ visible, onClose, ...rest }: ReadingSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ReadingForm onClose={onClose} {...rest} />
    </BottomSheet>
  );
}

function ReadingForm({ unit, lastValue, today, onSave, onClose }: Omit<ReadingSheetProps, 'visible'>) {
  const [text, setText] = useState('');
  const [date, setDate] = useState<DateKey>(today);
  const value = parseDecimal(text);
  const valid = value !== null && !Number.isNaN(value);

  return (
    <>
      <AppText variant="heading">Nowy odczyt</AppText>
      <TextField
        label={`Stan licznika (${unit})`}
        value={text}
        onChangeText={setText}
        placeholder={lastValue !== null ? `ostatnio ${formatDecimal(lastValue, 2)}` : 'np. 12345,6'}
        keyboardType="decimal-pad"
        autoFocus
        maxLength={12}
      />
      {valid && lastValue !== null && value < lastValue ? (
        <AppText variant="caption" tone="warning">
          Mniej niż poprzedni odczyt — sprawdź, czy to na pewno dobra liczba.
        </AppText>
      ) : null}
      <DateChoice
        value={date}
        onChange={(day) => day && setDate(day)}
        today={today}
        pickerTitle="Data odczytu"
        presets={recentDayPresets(today)}
      />
      <SheetActions>
        <Button label="Anuluj" variant="secondary" onPress={onClose} />
        <Button
          label="Zapisz"
          disabled={!valid}
          onPress={() => {
            if (value === null || Number.isNaN(value)) return;
            onSave(date, value);
            onClose();
          }}
        />
      </SheetActions>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
});
