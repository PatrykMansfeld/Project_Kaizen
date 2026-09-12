import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { EmojiBadge } from '@/components/emoji-badge';
import { EmptyState } from '@/components/empty-state';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { BILLS_SQL, BILL_TABLES, payBill, undoBillPayment, type Bill } from '@/db/bills';
import { useQuery } from '@/db/use-query';
import { formatMoney } from '@/features/finance/money';
import { StatRow, StatTile } from '@/features/stats/charts';
import { formatDayShort, type DateKey } from '@/lib/dates';
import { dueLabel, dueStatus } from '@/lib/due';
import { plural } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { FREQUENCIES, monthlyCost, nextBillDue } from './bills';

const openBill = (id: number | 'nowa') => router.push({ pathname: '/oplata/[id]', params: { id: String(id) } });

/** Stałe opłaty i subskrypcje: koszt miesięczny, najbliższe terminy i „Zapłacone” jednym stuknięciem. */
export function BillsScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const { rows: bills, loaded } = useQuery<Bill>(BILLS_SQL, [], BILL_TABLES);

  const active = bills.filter((bill) => bill.active);
  const monthly = active.reduce((sum, bill) => sum + monthlyCost(bill), 0);
  const due = active.filter((bill) => dueStatus(bill.next_due, today) !== 'later');
  const later = active.filter((bill) => dueStatus(bill.next_due, today) === 'later');
  const paused = bills.filter((bill) => !bill.active);

  const pay = async (bill: Bill) => {
    const nextDue = nextBillDue(bill.next_due, bill.frequency);
    const { transactionId, previousDue } = await payBill(db, bill, today, nextDue);
    Alert.alert(
      'Zapłacono',
      `${bill.name}: ${formatMoney(bill.amount)} zapisano w Wydatkach.\nNastępny termin: ${formatDayShort(nextDue, today)}.`,
      [
        { text: 'Cofnij', style: 'destructive', onPress: () => void undoBillPayment(db, bill.id, transactionId, previousDue) },
        { text: 'OK' },
      ],
    );
  };

  return (
    <ScrollScreen
      title="Stałe opłaty"
      headerRight={<IconButton icon="add" accessibilityLabel="Nowa opłata" onPress={() => openBill('nowa')} />}>
      {loaded && bills.length === 0 ? (
        <EmptyState
          icon="event_repeat"
          title="Brak stałych opłat"
          description="Dodaj czynsz, telefon czy subskrypcje — zobaczysz, ile kosztują co miesiąc, i dostaniesz przypomnienie przed terminem."
        />
      ) : null}

      {active.length > 0 ? (
        <StatRow>
          <StatTile label="Miesięcznie" value={formatMoney(monthly)} detail={plural(active.length, ['opłata', 'opłaty', 'opłat'])} />
          <StatTile label="Rocznie" value={formatMoney(monthly * 12)} detail="przy obecnych kwotach" />
        </StatRow>
      ) : null}

      {due.length > 0 ? (
        <Section title="Do zapłaty w tym tygodniu">
          {due.map((bill) => (
            <BillRow key={bill.id} bill={bill} today={today} onPay={() => pay(bill)} />
          ))}
        </Section>
      ) : null}
      {later.length > 0 ? (
        <Section title="Później">
          {later.map((bill) => (
            <BillRow key={bill.id} bill={bill} today={today} />
          ))}
        </Section>
      ) : null}
      {paused.length > 0 ? (
        <Section title="Wstrzymane">
          {paused.map((bill) => (
            <BillRow key={bill.id} bill={bill} today={today} />
          ))}
        </Section>
      ) : null}
    </ScrollScreen>
  );
}

function BillRow({ bill, today, onPay }: { bill: Bill; today: DateKey; onPay?: () => void }) {
  const { dark } = useTheme();
  const status = dueStatus(bill.next_due, today);

  return (
    <Card variant="row" onPress={() => openBill(bill.id)}>
      <EmojiBadge emoji={bill.icon} color={paletteColor(bill.color, dark)} size={40} />
      <View style={styles.body}>
        <AppText numberOfLines={1}>{bill.name}</AppText>
        <AppText variant="caption" tone={bill.active && status === 'overdue' ? 'danger' : 'textSecondary'} numberOfLines={1}>
          {bill.active ? `${dueLabel(bill.next_due, today)} · ` : ''}
          {FREQUENCIES[bill.frequency].label.toLowerCase()}
        </AppText>
      </View>
      <View style={styles.right}>
        <AppText variant="bodyStrong">{formatMoney(bill.amount)}</AppText>
        {onPay ? <Chip label="Zapłacone" icon="check" selected={false} onPress={onPay} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: spacing.xs },
});
