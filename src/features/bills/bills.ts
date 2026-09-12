import type { Bill, BillFrequency } from '@/db/bills';
import { addDays, addMonths, type DateKey } from '@/lib/dates';

export const FREQUENCIES: Record<BillFrequency, { label: string; perYear: number }> = {
  weekly: { label: 'Co tydzień', perYear: 52 },
  monthly: { label: 'Co miesiąc', perYear: 12 },
  quarterly: { label: 'Co kwartał', perYear: 4 },
  yearly: { label: 'Co rok', perYear: 1 },
};

export const FREQUENCY_KEYS = Object.keys(FREQUENCIES) as BillFrequency[];

/** Kolejny termin po zapłaceniu: +1 okres od obecnego terminu (a nie od dnia zapłaty). */
export function nextBillDue(due: DateKey, frequency: BillFrequency): DateKey {
  switch (frequency) {
    case 'weekly':
      return addDays(due, 7);
    case 'monthly':
      return addMonths(due, 1);
    case 'quarterly':
      return addMonths(due, 3);
    case 'yearly':
      return addMonths(due, 12);
  }
}

/** Koszt przeliczony na miesiąc (grosze) — do sumy „ile płacę co miesiąc”. */
export function monthlyCost(bill: Pick<Bill, 'amount' | 'frequency'>) {
  return Math.round((bill.amount * FREQUENCIES[bill.frequency].perYear) / 12);
}
