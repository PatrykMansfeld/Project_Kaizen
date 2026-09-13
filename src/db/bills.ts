import type { SQLiteDatabase } from 'expo-sqlite';

import { TRANSACTION_SELECT, createTransaction } from '@/db/finance';
import type { Table } from '@/db/use-query';
import type { DateKey } from '@/lib/dates';

export type BillFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type Bill = {
  id: number;
  name: string;
  /** Emoji. */
  icon: string;
  /** Klucz z palety theme/palette.ts. */
  color: string;
  /** Kwota w groszach. */
  amount: number;
  frequency: BillFrequency;
  /** Najbliższy termin płatności. */
  next_due: DateKey;
  category_id: number | null;
  /** Ile dni przed terminem przypomnieć; null = bez przypomnienia. */
  remind_days_before: number | null;
  active: 0 | 1;
  note: string;
  created_at: string;
};

export type BillInput = Pick<
  Bill,
  'name' | 'icon' | 'color' | 'amount' | 'frequency' | 'next_due' | 'category_id' | 'remind_days_before' | 'note'
> & { active: boolean };

export const BILL_TABLES: readonly Table[] = ['recurring_bills', 'transactions'];

/** Aktywne od najbliższego terminu, wstrzymane na końcu. */
export const BILLS_SQL = 'SELECT * FROM recurring_bills ORDER BY active DESC, next_due, name';

/** Ile aktywnych opłat ma termin do $until (włącznie z zaległymi) — do skrótu na ekranie Dziś. */
export const BILLS_DUE_COUNT_SQL = 'SELECT COUNT(*) AS n FROM recurring_bills WHERE active = 1 AND next_due <= $until';

/** Historia płatności opłaty (wydatki zapisane przyciskiem „Zapłacone”). */
export const BILL_PAYMENTS_SQL = `${TRANSACTION_SELECT} WHERE t.bill_id = $bill ORDER BY t.date DESC, t.id DESC`;

export function getBill(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Bill>('SELECT * FROM recurring_bills WHERE id = ?', id);
}

function toParams(input: BillInput) {
  return {
    $name: input.name,
    $icon: input.icon,
    $color: input.color,
    $amount: input.amount,
    $frequency: input.frequency,
    $due: input.next_due,
    $category: input.category_id,
    $remind: input.remind_days_before,
    $active: input.active ? 1 : 0,
    $note: input.note,
  };
}

export function createBill(db: SQLiteDatabase, input: BillInput) {
  return db.runAsync(
    `INSERT INTO recurring_bills (name, icon, color, amount, frequency, next_due, category_id, remind_days_before, active, note)
     VALUES ($name, $icon, $color, $amount, $frequency, $due, $category, $remind, $active, $note)`,
    toParams(input),
  );
}

export function updateBill(db: SQLiteDatabase, id: number, input: BillInput) {
  return db.runAsync(
    `UPDATE recurring_bills SET name = $name, icon = $icon, color = $color, amount = $amount, frequency = $frequency,
       next_due = $due, category_id = $category, remind_days_before = $remind, active = $active, note = $note
     WHERE id = $id`,
    { ...toParams(input), $id: id },
  );
}

/** Historia płatności zostaje w Wydatkach (bez powiązania z opłatą). */
export function deleteBill(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM recurring_bills WHERE id = ?', id);
}

/**
 * „Zapłacone”: wydatek z kwotą i kategorią opłaty, a termin przeskakuje o jeden okres.
 * Zwraca id wydatku i poprzedni termin — do cofnięcia (undoBillPayment).
 */
export async function payBill(db: SQLiteDatabase, bill: Bill, paidOn: DateKey, nextDue: DateKey) {
  let transactionId = 0;
  await db.withTransactionAsync(async () => {
    transactionId = (
      await createTransaction(db, {
        type: 'expense',
        amount: bill.amount,
        category_id: bill.category_id,
        date: paidOn,
        note: bill.name,
        bill_id: bill.id,
      })
    ).lastInsertRowId;
    await db.runAsync('UPDATE recurring_bills SET next_due = ? WHERE id = ?', nextDue, bill.id);
  });
  return { transactionId, previousDue: bill.next_due };
}

export async function undoBillPayment(db: SQLiteDatabase, billId: number, transactionId: number, previousDue: DateKey) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transactions WHERE id = ?', transactionId);
    await db.runAsync('UPDATE recurring_bills SET next_due = ? WHERE id = ?', previousDue, billId);
  });
}
