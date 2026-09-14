import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { EmptyLine } from '@/components/empty-state';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { ShowAllLink } from '@/components/text-link';
import {
  CHORES_SQL,
  HOME_TABLES,
  METERS_SQL,
  WARRANTIES_SQL,
  markChoreDone,
  type Chore,
  type MeterWithReadings,
  type Warranty,
} from '@/db/home';
import { useQuery } from '@/db/use-query';
import { addDays, formatDayShort, type DateKey } from '@/lib/dates';
import { dueLabel, dueStatus } from '@/lib/due';
import { formatDecimal } from '@/lib/format';
import { useToday } from '@/lib/use-today';

import { WARRANTY_WARNING_DAYS, formatUsage, intervalLabel, meterUsage, warrantyLabel } from './home';

/** Ile gwarancji pokazać przed „Pokaż wszystkie”. */
const WARRANTIES_PREVIEW = 5;

/** Dom: obowiązki co N dni, gwarancje i odczyty liczników. */
export function HomeScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const [allWarranties, setAllWarranties] = useState(false);
  const { rows: chores } = useQuery<Chore>(CHORES_SQL, [], HOME_TABLES);
  const { rows: warranties } = useQuery<Warranty>(WARRANTIES_SQL, { $today: today }, HOME_TABLES);
  const { rows: meters } = useQuery<MeterWithReadings>(METERS_SQL, [], HOME_TABLES);
  const visibleWarranties = allWarranties ? warranties : warranties.slice(0, WARRANTIES_PREVIEW);

  return (
    <ScrollScreen title="Dom">
      <Section title="Obowiązki" onAdd={() => router.push({ pathname: '/dom/obowiazek/[id]', params: { id: 'nowy' } })}>
        {chores.length === 0 ? <EmptyLine text="Np. wymiana filtra co 3 miesiące, pranie firan co pół roku." /> : null}
        {chores.map((chore) => (
          <ChoreRow key={chore.id} chore={chore} today={today} onDone={() => markChoreDone(db, chore, today)} />
        ))}
      </Section>

      <Section title="Gwarancje" onAdd={() => router.push({ pathname: '/dom/gwarancja/[id]', params: { id: 'nowa' } })}>
        {warranties.length === 0 ? <EmptyLine text="Zapisz datę zakupu i końca gwarancji — przypomnę miesiąc wcześniej." /> : null}
        {visibleWarranties.map((warranty) => (
          <WarrantyRow key={warranty.id} warranty={warranty} today={today} />
        ))}
        {warranties.length > WARRANTIES_PREVIEW ? (
          <ShowAllLink expanded={allWarranties} total={warranties.length} onPress={() => setAllWarranties(!allWarranties)} />
        ) : null}
      </Section>

      <Section title="Liczniki" onAdd={() => router.push({ pathname: '/dom/licznik/edycja/[id]', params: { id: 'nowy' } })}>
        {meters.length === 0 ? <EmptyLine text="Prąd, woda, gaz — wpisuj odczyty i sprawdzaj zużycie." /> : null}
        {meters.map((meter) => {
          const usage = meterUsage(
            { value: meter.last_value, date: meter.last_date },
            { value: meter.prev_value, date: meter.prev_date },
          );
          return (
            <Card key={meter.id} variant="row" onPress={() => router.push({ pathname: '/dom/licznik/[id]', params: { id: String(meter.id) } })}>
              <AppText style={styles.emoji}>{meter.icon}</AppText>
              <View style={styles.flex}>
                <AppText>{meter.name}</AppText>
                <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
                  {usage ? formatUsage(usage, meter.unit) : meter.last_date ? `Odczyt: ${formatDayShort(meter.last_date, today)}` : 'Brak odczytów'}
                </AppText>
              </View>
              {meter.last_value !== null ? (
                <AppText variant="bodyStrong">
                  {formatDecimal(meter.last_value, 2)} {meter.unit}
                </AppText>
              ) : null}
            </Card>
          );
        })}
      </Section>
    </ScrollScreen>
  );
}

function ChoreRow({ chore, today, onDone }: { chore: Chore; today: DateKey; onDone: () => void }) {
  const status = dueStatus(chore.next_due, today, 3);
  return (
    <Card variant="row" onPress={() => router.push({ pathname: '/dom/obowiazek/[id]', params: { id: String(chore.id) } })}>
      <AppText style={styles.emoji}>{chore.icon}</AppText>
      <View style={styles.flex}>
        <AppText numberOfLines={1}>{chore.name}</AppText>
        <AppText variant="caption" tone={status === 'overdue' ? 'danger' : 'textSecondary'} numberOfLines={1}>
          {dueLabel(chore.next_due, today)} · {intervalLabel(chore.interval_days)}
        </AppText>
      </View>
      {status !== 'later' ? <Chip label="Zrobione" icon="check" selected={false} onPress={onDone} /> : null}
    </Card>
  );
}

function WarrantyRow({ warranty, today }: { warranty: Warranty; today: DateKey }) {
  const expired = warranty.expires_on < today;
  const soon = !expired && warranty.expires_on <= addDays(today, WARRANTY_WARNING_DAYS);
  return (
    <Card variant="row" onPress={() => router.push({ pathname: '/dom/gwarancja/[id]', params: { id: String(warranty.id) } })}>
      <AppText style={styles.emoji}>🧾</AppText>
      <View style={styles.flex}>
        <AppText tone={expired ? 'textMuted' : 'text'} numberOfLines={1}>
          {warranty.name}
        </AppText>
        <AppText variant="caption" tone={soon ? 'warning' : 'textSecondary'} numberOfLines={1}>
          do {formatDayShort(warranty.expires_on, today)} · {warrantyLabel(warranty.expires_on, today)}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  emoji: { fontSize: 24, width: 32, textAlign: 'center' },
});
