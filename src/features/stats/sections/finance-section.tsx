import { Card } from '@/components/card';
import { EmptyLine } from '@/components/empty-state';
import { Section } from '@/components/section';
import { CATEGORIES_SQL, FINANCE_TABLES, TRANSACTIONS_RANGE_SQL, type FinanceCategory, type Transaction } from '@/db/finance';
import { useQuery } from '@/db/use-query';
import { formatMoney, summarize } from '@/features/finance/money';
import { BarList, StatRow, StatTile } from '@/features/stats/charts';
import { useTheme } from '@/theme/use-theme';

import { versus, type SectionProps } from './shared';

export function FinanceSection({ range, period }: SectionProps) {
  const { colors } = useTheme();
  const { rows } = useQuery<Transaction>(TRANSACTIONS_RANGE_SQL, { $from: range.prevFrom, $to: range.to }, FINANCE_TABLES);
  const { rows: categories } = useQuery<FinanceCategory>(CATEGORIES_SQL, [], ['finance_categories']);

  const current = summarize(
    rows.filter((row) => row.date >= range.from),
    categories,
  );
  const previous = summarize(
    rows.filter((row) => row.date <= range.prevTo),
    categories,
  );
  const top = current.byCategory.filter((item) => item.amount > 0).slice(0, 5);

  return (
    <Section icon="payments" color={colors.finance} title="Wydatki">
      {current.expenses === 0 && current.income === 0 ? (
        <EmptyLine text="Brak wpisów w tym okresie. Wydatki dodasz na ekranie Dziś → Wydatki." />
      ) : (
        <>
          <StatRow>
            <StatTile
              label="Wydatki"
              value={formatMoney(current.expenses)}
              detail={previous.expenses || current.expenses ? versus(current.expenses - previous.expenses, period, formatMoney) : undefined}
            />
            <StatTile label="Bilans" value={`${current.balance > 0 ? '+' : ''}${formatMoney(current.balance)}`} detail="przychody − wydatki" />
          </StatRow>
          {top.length > 0 ? (
            <Card>
              <BarList
                items={top.map((item) => ({
                  key: String(item.category?.id ?? 'none'),
                  label: `${item.category?.icon ?? '📦'} ${item.category?.name ?? 'Bez kategorii'}`,
                  value: item.amount,
                  valueLabel: formatMoney(item.amount),
                }))}
                max={Math.max(...top.map((item) => item.amount), 1)}
                color={colors.finance}
              />
            </Card>
          ) : null}
        </>
      )}
    </Section>
  );
}
