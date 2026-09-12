import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { Chip, ChipRow } from '@/components/chip';
import { EmptyLine } from '@/components/empty-state';
import { HeaderActions } from '@/components/header';
import { Icon } from '@/components/icon';
import { PeriodNavigator } from '@/components/period-navigator';
import { PromptSheet } from '@/components/prompt-sheet';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import {
  CATEGORIES_SQL,
  FINANCE_TABLES,
  TRANSACTIONS_RANGE_SQL,
  type FinanceCategory,
  type Transaction,
  type TransactionType,
} from '@/db/finance';
import { deleteSetting, setSetting } from '@/db/settings';
import { useQuery, useSetting } from '@/db/use-query';
import {
  dailyAllowance,
  formatMoney,
  moneyInputText,
  parseMoney,
  summarize,
  type CategorySpending,
} from '@/features/finance/money';
import { TransactionRow } from '@/features/finance/transaction-row';
import { useModuleVisible, useOpenModule } from '@/features/modules/preferences';
import { Meter, StatRow, StatTile } from '@/features/stats/charts';
import { periodRange, shiftPeriod } from '@/features/stats/compute';
import { groupBy } from '@/lib/collections';
import { MONTHS, formatDayRelative, fromDateKey, type DateKey } from '@/lib/dates';
import { capitalize } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Filtr listy: id kategorii, 'none' = bez kategorii, null = wszystko. */
type CategoryFilter = number | 'none' | null;

const addTransaction = (type: TransactionType) =>
  router.push({ pathname: '/finanse/transakcja/[id]', params: { id: 'nowa', type } });

/** Wydatki i budżet: miesiąc, limit, podział na kategorie i lista wpisów. */
export function FinanceScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const [anchor, setAnchor] = useState<DateKey>(today);
  const [filter, setFilter] = useState<CategoryFilter>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const openModule = useOpenModule();
  const billsVisible = useModuleVisible('oplaty');

  const range = periodRange('month', anchor);
  const isCurrent = range.from <= today && today <= range.to;
  const { rows: transactions, loaded } = useQuery<Transaction>(
    TRANSACTIONS_RANGE_SQL,
    { $from: range.from, $to: range.to },
    FINANCE_TABLES,
  );
  const { rows: categories } = useQuery<FinanceCategory>(CATEGORIES_SQL, [], ['finance_categories']);
  const budgetValue = useSetting('monthly_budget');
  const budget = budgetValue ? Number(budgetValue) : null;
  const summary = summarize(transactions, categories);

  const monthDate = fromDateKey(range.from);
  const visible = transactions.filter(
    (transaction) =>
      filter === null ||
      (filter === 'none' ? transaction.type === 'expense' && transaction.category_id === null : transaction.category_id === filter),
  );

  const changeMonth = (delta: number) => {
    setAnchor(shiftPeriod('month', anchor, delta));
    setFilter(null);
  };

  const saveBudget = async (text: string) => {
    const value = parseMoney(text);
    if (value === null || Number.isNaN(value) || value <= 0) {
      Alert.alert('Niepoprawna kwota', 'Wpisz budżet w złotych, np. 3000 albo 2500,50.');
      return;
    }
    await setSetting(db, 'monthly_budget', String(value));
  };

  return (
    <ScrollScreen
      title="Wydatki"
      headerRight={
        <HeaderActions>
          <IconButton icon="category" accessibilityLabel="Kategorie" onPress={() => router.push('/finanse/kategorie')} />
          <IconButton icon="add" accessibilityLabel="Nowy wydatek" onPress={() => addTransaction('expense')} />
        </HeaderActions>
      }>
      <PeriodNavigator
        title={`${capitalize(MONTHS[monthDate.getMonth()])} ${monthDate.getFullYear()}`}
        subtitle={isCurrent ? 'Ten miesiąc' : undefined}
        onPrevious={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
        canGoNext={!isCurrent}
        unitLabel={{ previous: 'Poprzedni miesiąc', next: 'Następny miesiąc' }}
      />

      <View style={styles.summary}>
        <StatRow>
          <StatTile label="Wydatki" value={formatMoney(summary.expenses)} />
          <StatTile label="Przychody" value={formatMoney(summary.income)} />
        </StatRow>
        <StatRow>
          <StatTile
            label="Bilans"
            value={`${summary.balance > 0 ? '+' : ''}${formatMoney(summary.balance)}`}
            detail={summary.balance >= 0 ? 'na plusie' : 'na minusie'}
          />
        </StatRow>
        <ChipRow>
          <Chip label="Wydatek" icon="remove" selected={false} onPress={() => addTransaction('expense')} />
          <Chip label="Przychód" icon="add" selected={false} onPress={() => addTransaction('income')} />
          {billsVisible ? <Chip label="Stałe opłaty" icon="event_repeat" selected={false} onPress={() => openModule('oplaty')} /> : null}
        </ChipRow>
      </View>

      <BudgetCard
        budget={budget}
        spent={summary.expenses}
        allowance={budget && isCurrent ? dailyAllowance(budget, summary.expenses, today, range.to) : null}
        onEdit={() => setBudgetOpen(true)}
        onRemove={() => deleteSetting(db, 'monthly_budget')}
      />

      {summary.byCategory.length > 0 ? (
        <Section title="Kategorie wydatków">
          <Card style={styles.categories}>
            {summary.byCategory.map((item) => {
              const key: CategoryFilter = item.category?.id ?? 'none';
              return (
                <CategoryRow
                  key={String(key)}
                  item={item}
                  total={summary.expenses}
                  selected={filter === key}
                  onPress={() => setFilter(filter === key ? null : key)}
                />
              );
            })}
          </Card>
        </Section>
      ) : null}

      <Section
        title={filter === null ? 'Wpisy' : 'Wpisy z kategorii'}
        action={
          filter !== null ? (
            <Pressable onPress={() => setFilter(null)} hitSlop={8} accessibilityRole="button">
              <AppText variant="caption" tone="accent">
                Pokaż wszystkie
              </AppText>
            </Pressable>
          ) : undefined
        }>
        {loaded && visible.length === 0 ? (
          <EmptyLine
            text={
              filter === null
                ? 'Brak wpisów w tym miesiącu. Dodaj wydatek przyciskiem „Wydatek” albo + w nagłówku.'
                : 'Brak wpisów w tej kategorii.'
            }
          />
        ) : null}
      </Section>
      {[...groupBy(visible, (transaction) => transaction.date)].map(([date, dayTransactions]) => {
        const spent = dayTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
        return (
          <Section key={date} title={formatDayRelative(date, today)} meta={spent ? `−${formatMoney(spent)}` : undefined}>
            {dayTransactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </Section>
        );
      })}

      <PromptSheet
        visible={budgetOpen}
        title="Budżet miesięczny (zł)"
        placeholder="np. 3000"
        initialValue={budget ? moneyInputText(budget) : ''}
        keyboardType="decimal-pad"
        onSubmit={saveBudget}
        onClose={() => setBudgetOpen(false)}
      />
    </ScrollScreen>
  );
}

type BudgetCardProps = {
  budget: number | null;
  spent: number;
  /** Ile dziennie do końca miesiąca (tylko bieżący miesiąc). */
  allowance: number | null;
  onEdit: () => void;
  onRemove: () => void;
};

function BudgetCard({ budget, spent, allowance, onEdit, onRemove }: BudgetCardProps) {
  const { colors } = useTheme();

  if (budget === null) {
    return (
      <Card onPress={onEdit} variant="row">
        <Icon name="savings" color={colors.finance} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Ustaw miesięczny budżet</AppText>
          <AppText variant="caption" tone="textSecondary">
            Zobaczysz, ile jeszcze możesz wydać i ile to dziennie.
          </AppText>
        </View>
        <Icon name="chevron_right" color={colors.textMuted} />
      </Card>
    );
  }

  const ratio = spent / budget;
  const over = spent > budget;
  const meterColor = over ? colors.danger : ratio >= 0.9 ? colors.warning : colors.finance;

  return (
    <Card>
      <View style={styles.budgetHeader}>
        <AppText variant="label" tone="textSecondary" style={styles.flex}>
          Budżet
        </AppText>
        <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button">
          <AppText variant="caption" tone="accent">
            Zmień
          </AppText>
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button">
          <AppText variant="caption" tone="textMuted">
            Usuń
          </AppText>
        </Pressable>
      </View>
      <View style={styles.budgetAmounts}>
        <AppText variant="heading">{formatMoney(spent)}</AppText>
        <AppText tone="textSecondary">z {formatMoney(budget)}</AppText>
      </View>
      <Meter value={ratio} color={meterColor} />
      {over ? (
        <View style={styles.warningRow}>
          <Icon name="warning" size={16} color={colors.danger} />
          <AppText variant="caption" tone="danger">
            Budżet przekroczony o {formatMoney(spent - budget)}
          </AppText>
        </View>
      ) : (
        <AppText variant="caption" tone="textSecondary">
          Zostało {formatMoney(budget - spent)}
          {allowance !== null ? ` · ok. ${formatMoney(allowance)} dziennie do końca miesiąca` : ''}
        </AppText>
      )}
    </Card>
  );
}

type CategoryRowProps = { item: CategorySpending; total: number; selected: boolean; onPress: () => void };

function CategoryRow({ item, total, selected, onPress }: CategoryRowProps) {
  const { colors, dark } = useTheme();
  const { category, amount, budget } = item;
  const over = budget !== null && amount > budget;
  const color = category ? paletteColor(category.color, dark) : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.categoryRow, selected && { backgroundColor: colors.accentSoft }]}>
      <View style={styles.categoryHeader}>
        <AppText>{category?.icon ?? '📦'}</AppText>
        <AppText style={styles.flex} numberOfLines={1}>
          {category?.name ?? 'Bez kategorii'}
        </AppText>
        <AppText variant="bodyStrong">{formatMoney(amount)}</AppText>
      </View>
      <Meter value={budget ? amount / budget : total ? amount / total : 0} color={over ? colors.danger : color} />
      <AppText variant="caption" tone={over ? 'danger' : 'textMuted'}>
        {budget !== null
          ? over
            ? `Limit ${formatMoney(budget)} · ponad o ${formatMoney(amount - budget)}`
            : `Limit ${formatMoney(budget)} · zostało ${formatMoney(budget - amount)}`
          : `${total ? Math.round((amount / total) * 100) : 0}% wydatków`}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { gap: spacing.sm },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  budgetAmounts: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  categories: { gap: spacing.xs, padding: spacing.sm },
  categoryRow: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
