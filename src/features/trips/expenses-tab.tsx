import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyLine } from '@/components/empty-state';
import { Section } from '@/components/section';
import { CATEGORIES_SQL, FINANCE_TABLES, type FinanceCategory, type Transaction } from '@/db/finance';
import { TRIP_TRANSACTIONS_SQL, type Trip } from '@/db/trips';
import { useQuery } from '@/db/use-query';
import { formatMoney, summarize } from '@/features/finance/money';
import { TransactionRow } from '@/features/finance/transaction-row';
import { BarList, Meter } from '@/features/stats/charts';
import type { DateKey } from '@/lib/dates';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { tripDayNumber, tripLength } from './trips';

export function ExpensesTab({ trip, today }: { trip: Trip; today: DateKey }) {
  const { colors, dark } = useTheme();
  const color = paletteColor(trip.color, dark);
  const { rows: transactions } = useQuery<Transaction>(TRIP_TRANSACTIONS_SQL, { $trip: trip.id }, FINANCE_TABLES);
  const { rows: categories } = useQuery<FinanceCategory>(CATEGORIES_SQL, [], ['finance_categories']);
  const summary = summarize(transactions, categories);
  const spent = summary.expenses;
  const byCategory = summary.byCategory.filter((entry) => entry.amount > 0);
  const over = trip.budget !== null && spent > trip.budget;
  // W trakcie wyjazdu średnia z dni, które już minęły.
  const daysSoFar = today < trip.start_date ? 0 : Math.min(tripLength(trip), tripDayNumber(trip, today));

  const addExpense = () =>
    router.push({
      pathname: '/finanse/transakcja/[id]',
      params: { id: 'nowa', trip: String(trip.id), ...(today >= trip.start_date && today <= trip.end_date ? {} : { date: trip.start_date }) },
    });

  return (
    <>
      <Card style={styles.progress}>
        <AppText variant="caption" tone="textSecondary">
          Wydane na wyjazd
        </AppText>
        <AppText variant="title">{formatMoney(spent)}</AppText>
        {trip.budget ? (
          <>
            <Meter value={spent / trip.budget} color={over ? colors.danger : color} />
            <AppText variant="caption" tone={over ? 'danger' : 'textSecondary'}>
              {over ? `Ponad budżet o ${formatMoney(spent - trip.budget)}` : `Zostało ${formatMoney(trip.budget - spent)} z ${formatMoney(trip.budget)}`}
            </AppText>
          </>
        ) : null}
        {spent > 0 && daysSoFar > 0 ? (
          <AppText variant="caption" tone="textMuted">
            Średnio {formatMoney(Math.round(spent / daysSoFar))} dziennie
          </AppText>
        ) : null}
      </Card>

      <Button label="Dodaj wydatek" icon="add" onPress={addExpense} />

      {byCategory.length > 1 ? (
        <Section title="Na co">
          <BarList
            items={byCategory.map((entry) => ({
              key: String(entry.category?.id ?? 'none'),
              label: entry.category ? `${entry.category.icon} ${entry.category.name}` : 'Bez kategorii',
              value: entry.amount,
              valueLabel: formatMoney(entry.amount),
            }))}
            max={byCategory[0].amount}
            color={color}
          />
        </Section>
      ) : null}

      <Section title="Wpisy">
        {transactions.length === 0 ? (
          <EmptyLine text="Bilety, noclegi, jedzenie — wydatki z tej podróży trafią też do modułu Wydatki." />
        ) : null}
        {transactions.map((transaction) => (
          <TransactionRow key={transaction.id} transaction={transaction} hideTrip />
        ))}
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  progress: { gap: spacing.sm },
});
