import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { CheckCircle } from '@/components/check-circle';
import { Chip, ChipRow } from '@/components/chip';
import { DayNavigator } from '@/components/day-navigator';
import { EmojiBadge } from '@/components/emoji-badge';
import { EmptyLine, EmptyState } from '@/components/empty-state';
import { PromptSheet } from '@/components/prompt-sheet';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import {
  MEDICATIONS_SQL,
  MED_LOGS_DAY_SQL,
  MED_TABLES,
  addStock,
  parseTimes,
  takeDose,
  untakeDose,
  type Medication,
  type MedicationLog,
} from '@/db/meds';
import { useQuery } from '@/db/use-query';
import { Meter } from '@/features/stats/charts';
import { groupBy } from '@/lib/collections';
import type { DateKey } from '@/lib/dates';
import { plural } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { LOW_STOCK_DAYS, currentTime, daysOfSupply, dosesForDay } from './meds';

const openMed = (id: number | 'nowy') => router.push({ pathname: '/lek/[id]', params: { id: String(id) } });

/** Leki i suplementy: dawki dnia do odhaczenia, leki doraźne i zapasy. */
export function MedsScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();
  const [date, setDate] = useState<DateKey>(today);
  const [refill, setRefill] = useState<Medication | null>(null);

  const { rows: meds, loaded } = useQuery<Medication>(MEDICATIONS_SQL, [], MED_TABLES);
  const { rows: logs } = useQuery<MedicationLog>(MED_LOGS_DAY_SQL, { $date: date }, ['medication_logs']);

  const doses = dosesForDay(meds, date);
  const taken = new Set(logs.map((log) => `${log.medication_id}|${log.time}`));
  const takenCount = doses.filter((dose) => taken.has(`${dose.med.id}|${dose.time}`)).length;
  const asNeeded = meds.filter((med) => med.active && parseTimes(med.times).length === 0);
  const stocked = meds.filter((med) => med.active && med.stock !== null);
  const paused = meds.filter((med) => !med.active);

  const toggle = (med: Medication, time: string) =>
    taken.has(`${med.id}|${time}`) ? untakeDose(db, med, date, time) : takeDose(db, med, date, time);

  const saveRefill = async (text: string) => {
    const amount = /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN;
    if (!refill || !(amount > 0)) {
      Alert.alert('Niepoprawna liczba', 'Wpisz, ile sztuk dochodzi, np. 30.');
      return;
    }
    await addStock(db, refill.id, amount);
  };

  return (
    <ScrollScreen title="Leki" headerRight={<IconButton icon="add" accessibilityLabel="Nowy lek" onPress={() => openMed('nowy')} />}>
      {loaded && meds.length === 0 ? (
        <EmptyState
          icon="medication"
          color={colors.danger}
          title="Brak leków"
          description="Dodaj lek albo suplement z godzinami dawek — odhaczysz je tutaj, a aplikacja przypomni o dawce i o końcu zapasu."
        />
      ) : null}

      {meds.length > 0 ? (
        <>
          <DayNavigator date={date} today={today} onChange={setDate} maxDate={today} />

          {doses.length > 0 ? (
            <Card style={styles.progress}>
              <AppText variant="bodyStrong">
                Dawki: {takenCount} z {doses.length}
              </AppText>
              <Meter value={takenCount / doses.length} color={colors.danger} />
            </Card>
          ) : null}

          {[...groupBy(doses, (dose) => dose.time)].map(([time, slots]) => (
            <Section key={time} title={time}>
              {slots.map(({ med }) => {
                const done = taken.has(`${med.id}|${time}`);
                return (
                  <DoseRow key={med.id} med={med} done={done} onToggle={() => toggle(med, time)} onPress={() => openMed(med.id)} />
                );
              })}
            </Section>
          ))}

          {asNeeded.length > 0 ? (
            <Section title="Doraźnie">
              {asNeeded.map((med) => {
                const medLogs = logs.filter((log) => log.medication_id === med.id);
                return (
                  <AsNeededRow
                    key={med.id}
                    med={med}
                    logs={medLogs}
                    onTake={() => takeDose(db, med, date, date === today ? currentTime() : '12:00')}
                    onUndo={(log) => untakeDose(db, med, date, log.time)}
                  />
                );
              })}
            </Section>
          ) : null}

          {stocked.length > 0 ? (
            <Section title="Zapasy">
              {stocked.map((med) => (
                <StockRow key={med.id} med={med} onRefill={() => setRefill(med)} />
              ))}
            </Section>
          ) : null}

          {paused.length > 0 ? (
            <Section title="Wstrzymane">
              {paused.map((med) => (
                <Card key={med.id} variant="row" onPress={() => openMed(med.id)}>
                  <AppText>{med.icon}</AppText>
                  <AppText tone="textSecondary" style={styles.flex}>
                    {med.name}
                  </AppText>
                </Card>
              ))}
            </Section>
          ) : null}

          {doses.length === 0 && asNeeded.length === 0 ? <EmptyLine text="Na ten dzień nie ma zaplanowanych dawek." /> : null}
        </>
      ) : null}

      <PromptSheet
        visible={refill !== null}
        title={refill ? `Uzupełnij: ${refill.name}` : ''}
        placeholder="ile sztuk dochodzi, np. 30"
        keyboardType="number-pad"
        submitLabel="Dodaj"
        onSubmit={saveRefill}
        onClose={() => setRefill(null)}
      />
    </ScrollScreen>
  );
}

type DoseRowProps = { med: Medication; done: boolean; onToggle: () => void; onPress: () => void };

function DoseRow({ med, done, onToggle, onPress }: DoseRowProps) {
  const { colors, dark } = useTheme();
  return (
    <Card variant="row" onPress={onPress}>
      <CheckCircle
        checked={done}
        onPress={onToggle}
        color={paletteColor(med.color, dark)}
        accessibilityLabel={done ? `Cofnij: ${med.name}` : `Wzięte: ${med.name}`}
      />
      <AppText>{med.icon}</AppText>
      <View style={styles.flex}>
        <AppText style={done && { color: colors.textMuted, textDecorationLine: 'line-through' }}>{med.name}</AppText>
        {med.dose ? (
          <AppText variant="caption" tone="textSecondary">
            {med.dose}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

type AsNeededRowProps = { med: Medication; logs: MedicationLog[]; onTake: () => void; onUndo: (log: MedicationLog) => void };

function AsNeededRow({ med, logs, onTake, onUndo }: AsNeededRowProps) {
  const { dark } = useTheme();
  return (
    <Card style={styles.asNeeded}>
      <View style={styles.row}>
        <EmojiBadge emoji={med.icon} color={paletteColor(med.color, dark)} size={36} />
        <View style={styles.flex}>
          <AppText>{med.name}</AppText>
          <AppText variant="caption" tone="textSecondary">
            {logs.length ? `Dziś: ${plural(logs.length, ['raz', 'razy', 'razy'])}` : med.dose || 'Doraźnie'}
          </AppText>
        </View>
        <Chip label="Wziąłem" icon="check" selected={false} onPress={onTake} />
      </View>
      {logs.length > 0 ? (
        <ChipRow>
          {logs.map((log) => (
            <Chip key={log.id} label={`${log.time} ✕`} selected={false} onPress={() => onUndo(log)} />
          ))}
        </ChipRow>
      ) : null}
    </Card>
  );
}

function StockRow({ med, onRefill }: { med: Medication; onRefill: () => void }) {
  const days = daysOfSupply(med);
  const low = days !== null && days <= LOW_STOCK_DAYS;
  return (
    <Card variant="row">
      <AppText>{med.icon}</AppText>
      <View style={styles.flex}>
        <AppText>{med.name}</AppText>
        <AppText variant="caption" tone={low ? 'danger' : 'textSecondary'}>
          Zostało {plural(med.stock ?? 0, ['sztuka', 'sztuki', 'sztuk'])}
          {days !== null ? ` · ${low ? 'kup zapas — ' : ''}ok. ${plural(days, ['dzień', 'dni', 'dni'])}` : ''}
        </AppText>
      </View>
      <Chip label="Uzupełnij" icon="add" selected={false} onPress={onRefill} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progress: { gap: spacing.sm },
  asNeeded: { gap: spacing.sm, paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
