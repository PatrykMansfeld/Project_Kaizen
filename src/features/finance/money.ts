import type { FinanceCategory, Transaction, TransactionType } from '@/db/finance';
import { diffDays, type DateKey } from '@/lib/dates';

const NBSP = '\u00a0';
/** Największa kwota jednego wpisu: 10 mln zł. */
const MAX_AMOUNT = 1_000_000_000;

/** Grosze → „1 234,50 zł”, pełne złote bez końcówki: „45 zł”. */
export function formatMoney(grosze: number) {
  const negative = grosze < 0;
  const absolute = Math.abs(Math.round(grosze));
  const zloty = String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const rest = absolute % 100;
  return `${negative ? '−' : ''}${zloty}${rest ? `,${String(rest).padStart(2, '0')}` : ''}${NBSP}zł`;
}

/** Kwota wpisu ze znakiem: wydatek „−45 zł”, przychód „+3 000 zł”. */
export function formatSignedMoney(grosze: number, type: TransactionType) {
  return `${type === 'expense' ? '−' : '+'}${formatMoney(grosze)}`;
}

/** Kwota do pola tekstowego: 1250 → „12,50”, 4500 → „45”. */
export function moneyInputText(grosze: number) {
  const rest = grosze % 100;
  return `${Math.floor(grosze / 100)}${rest ? `,${String(rest).padStart(2, '0')}` : ''}`;
}

/**
 * Tekst z pola („12,50”, „12.5”, „1 234”) → grosze. Pusty → null, niepoprawny albo ujemny → NaN.
 * Dopuszczamy najwyżej 2 miejsca po przecinku.
 */
export function parseMoney(text: string) {
  const normalized = text.replace(/\s/g, '').replace(',', '.');
  if (normalized === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  const [zloty, fraction = ''] = normalized.split('.');
  const grosze = Number(zloty) * 100 + Number(fraction.padEnd(2, '0'));
  return grosze <= MAX_AMOUNT ? grosze : NaN;
}

export type CategorySpending = {
  /** null = wpisy bez kategorii. */
  category: FinanceCategory | null;
  amount: number;
  /** Limit kategorii (grosze) albo null. */
  budget: number | null;
};

export type MonthSummary = {
  expenses: number;
  income: number;
  /** Przychody − wydatki. */
  balance: number;
  /** Wydatki według kategorii, od największej kwoty; kategorie z limitem pojawiają się także bez wydatków. */
  byCategory: CategorySpending[];
};

export function summarize(transactions: readonly Transaction[], categories: readonly FinanceCategory[]): MonthSummary {
  let expenses = 0;
  let income = 0;
  const spent = new Map<number | null, number>();
  for (const transaction of transactions) {
    if (transaction.type === 'income') {
      income += transaction.amount;
      continue;
    }
    expenses += transaction.amount;
    spent.set(transaction.category_id, (spent.get(transaction.category_id) ?? 0) + transaction.amount);
  }

  const byCategory: CategorySpending[] = categories
    .filter((category) => category.type === 'expense' && (spent.has(category.id) || category.monthly_budget !== null))
    .map((category) => ({ category, amount: spent.get(category.id) ?? 0, budget: category.monthly_budget }));
  // Wpisy, których kategoria została usunięta (albo nie istnieje), też się liczą.
  const known = new Set(byCategory.map((item) => item.category!.id));
  const orphaned = [...spent].filter(([id]) => id === null || !known.has(id)).reduce((sum, [, amount]) => sum + amount, 0);
  if (orphaned > 0) byCategory.push({ category: null, amount: orphaned, budget: null });
  byCategory.sort((a, b) => b.amount - a.amount);

  return { expenses, income, balance: income - expenses, byCategory };
}

/**
 * Ile można jeszcze wydawać dziennie, żeby zmieścić się w budżecie do końca miesiąca (łącznie z dziś).
 * Null, gdy budżet już przekroczony albo miesiąc się skończył.
 */
export function dailyAllowance(budget: number, spent: number, today: DateKey, monthEnd: DateKey) {
  const daysLeft = diffDays(today, monthEnd) + 1;
  if (daysLeft <= 0 || spent >= budget) return null;
  return Math.floor((budget - spent) / daysLeft);
}
