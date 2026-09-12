import type { SQLiteDatabase } from 'expo-sqlite';

import type { Table } from '@/db/use-query';
import type { DateKey } from '@/lib/dates';

export type TransactionType = 'expense' | 'income';

export type FinanceCategory = {
  id: number;
  name: string;
  /** Emoji. */
  icon: string;
  /** Klucz z palety theme/palette.ts. */
  color: string;
  type: TransactionType;
  /** Limit miesięczny w groszach albo null. */
  monthly_budget: number | null;
  sort_order: number;
  created_at: string;
};

export type CategoryInput = Pick<FinanceCategory, 'name' | 'icon' | 'color' | 'type' | 'monthly_budget'>;

export type Transaction = {
  id: number;
  type: TransactionType;
  /** Kwota w groszach, zawsze dodatnia (znak wynika z `type`). */
  amount: number;
  category_id: number | null;
  date: DateKey;
  note: string;
  /** Stała opłata, z której powstał wpis („Zapłacone”), albo null. */
  bill_id: number | null;
  created_at: string;
  /** Tylko w zapytaniach z TRANSACTION_COLUMNS. */
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
};

export type TransactionInput = Pick<Transaction, 'type' | 'amount' | 'category_id' | 'date' | 'note'> & {
  bill_id?: number | null;
};

/** Tabele, od których zależą ekrany finansów (do useQuery). */
export const FINANCE_TABLES: readonly Table[] = ['transactions', 'finance_categories'];

export const CATEGORIES_SQL = 'SELECT * FROM finance_categories ORDER BY type, sort_order, id';

/** Wpis razem z nazwą, emoji i kolorem kategorii. */
const TRANSACTION_COLUMNS = `t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color`;

/** Wpisy z okresu, od najnowszego. */
export const TRANSACTIONS_RANGE_SQL = `
  SELECT ${TRANSACTION_COLUMNS}
  FROM transactions t LEFT JOIN finance_categories c ON c.id = t.category_id
  WHERE t.date BETWEEN $from AND $to
  ORDER BY t.date DESC, t.id DESC`;

/** Suma wydatków w okresie (np. dziś — do skrótu na ekranie Dziś). */
export const EXPENSES_SUM_SQL = `
  SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
  WHERE type = 'expense' AND date BETWEEN $from AND $to`;

export function getTransaction(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Transaction>('SELECT * FROM transactions WHERE id = ?', id);
}

function transactionParams(input: TransactionInput) {
  return { $type: input.type, $amount: input.amount, $category: input.category_id, $date: input.date, $note: input.note };
}

export function createTransaction(db: SQLiteDatabase, input: TransactionInput) {
  return db.runAsync(
    `INSERT INTO transactions (type, amount, category_id, date, note, bill_id)
     VALUES ($type, $amount, $category, $date, $note, $bill)`,
    { ...transactionParams(input), $bill: input.bill_id ?? null },
  );
}

export function updateTransaction(db: SQLiteDatabase, id: number, input: TransactionInput) {
  return db.runAsync(
    `UPDATE transactions SET type = $type, amount = $amount, category_id = $category, date = $date, note = $note
     WHERE id = $id`,
    { ...transactionParams(input), $id: id },
  );
}

export function deleteTransaction(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

export function getCategory(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<FinanceCategory>('SELECT * FROM finance_categories WHERE id = ?', id);
}

function categoryParams(input: CategoryInput) {
  return {
    $name: input.name,
    $icon: input.icon,
    $color: input.color,
    $type: input.type,
    // Przychody nie mają limitu.
    $budget: input.type === 'expense' ? input.monthly_budget : null,
  };
}

/** Nowa kategoria trafia na koniec listy. */
export function createCategory(db: SQLiteDatabase, input: CategoryInput) {
  return db.runAsync(
    `INSERT INTO finance_categories (name, icon, color, type, monthly_budget, sort_order)
     VALUES ($name, $icon, $color, $type, $budget, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM finance_categories))`,
    categoryParams(input),
  );
}

export function updateCategory(db: SQLiteDatabase, id: number, input: CategoryInput) {
  return db.runAsync(
    `UPDATE finance_categories SET name = $name, icon = $icon, color = $color, type = $type, monthly_budget = $budget
     WHERE id = $id`,
    { ...categoryParams(input), $id: id },
  );
}

/** Wpisy zostają — tracą tylko kategorię (ON DELETE SET NULL). */
export function deleteCategory(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM finance_categories WHERE id = ?', id);
}
