import { Chip, ChipRow } from '@/components/chip';
import { BILLS_DUE_COUNT_SQL } from '@/db/bills';
import { EXPENSES_SUM_SQL } from '@/db/finance';
import { CHORES_DUE_COUNT_SQL } from '@/db/home';
import { MEDICATIONS_SQL, MED_LOGS_DAY_SQL, type Medication, type MedicationLog } from '@/db/meds';
import { SLEEP_DAY_SQL, type SleepLog } from '@/db/sleep';
import { useQuery, useSetting } from '@/db/use-query';
import { formatMoney } from '@/features/finance/money';
import { dosesForDay } from '@/features/meds/meds';
import { useModulePreferences, useOpenModule } from '@/features/modules/preferences';
import type { ModuleKey } from '@/features/modules/registry';
import { addDays, type DateKey } from '@/lib/dates';
import { formatDuration, plural } from '@/lib/format';
import { useTheme } from '@/theme/use-theme';

/**
 * Skróty na ekranie Dziś. Stałe (cele, podsumowanie, sen, przegląd, wydatki) i kontekstowe — opłaty, leki
 * i obowiązki pojawiają się tylko, gdy coś na dziś czeka. Ukryte moduły nie mają skrótów.
 */
export function TodayShortcuts({ today }: { today: DateKey }) {
  const { colors } = useTheme();
  const { hidden } = useModulePreferences();
  const open = useOpenModule();
  const shown = (key: ModuleKey) => !hidden.includes(key);

  const reviewed = useSetting('last_review_date') === today;
  const { rows: sleepRows } = useQuery<SleepLog>(SLEEP_DAY_SQL, { $date: today }, ['sleep_logs']);
  const { rows: spentRows } = useQuery<{ total: number }>(EXPENSES_SUM_SQL, { $from: today, $to: today }, ['transactions']);
  const { rows: billRows } = useQuery<{ n: number }>(BILLS_DUE_COUNT_SQL, { $until: addDays(today, 3) }, ['recurring_bills']);
  const { rows: choreRows } = useQuery<{ n: number }>(CHORES_DUE_COUNT_SQL, { $today: today }, ['home_chores']);
  const { rows: meds } = useQuery<Medication>(MEDICATIONS_SQL, [], ['medications']);
  const { rows: medLogs } = useQuery<MedicationLog>(MED_LOGS_DAY_SQL, { $date: today }, ['medication_logs']);

  const sleep = sleepRows[0];
  const spent = spentRows[0]?.total ?? 0;
  const billsDue = billRows[0]?.n ?? 0;
  const choresDue = choreRows[0]?.n ?? 0;
  const doses = dosesForDay(meds, today);
  const taken = new Set(medLogs.map((log) => `${log.medication_id}|${log.time}`));
  const dosesTaken = doses.filter((dose) => taken.has(`${dose.med.id}|${dose.time}`)).length;

  return (
    <ChipRow>
      {shown('cele') ? <Chip label="Cele" icon="sports_score" selected={false} onPress={() => open('cele')} /> : null}
      {shown('podsumowanie') ? (
        <Chip
          label={reviewed ? 'Dzień podsumowany' : 'Podsumuj dzień'}
          icon={reviewed ? 'done_all' : 'nights_stay'}
          selected={reviewed}
          onPress={() => open('podsumowanie')}
        />
      ) : null}
      {shown('sen') ? (
        <Chip label={sleep ? `Sen ${formatDuration(sleep.duration_min)}` : 'Sen'} icon="bedtime" selected={false} onPress={() => open('sen')} />
      ) : null}
      {shown('przeglad') ? (
        <Chip label="Przegląd tygodnia" icon="calendar_view_week" selected={false} onPress={() => open('przeglad')} />
      ) : null}
      {shown('finanse') ? (
        <Chip
          label={spent ? `Wydatki ${formatMoney(spent)}` : 'Wydatki'}
          icon="payments"
          iconColor={colors.finance}
          selected={false}
          onPress={() => open('finanse')}
        />
      ) : null}
      {shown('oplaty') && billsDue > 0 ? (
        <Chip
          label={`Opłaty: ${plural(billsDue, ['do zapłaty', 'do zapłaty', 'do zapłaty'])}`}
          icon="event_repeat"
          iconColor={colors.finance}
          selected={false}
          onPress={() => open('oplaty')}
        />
      ) : null}
      {shown('leki') && doses.length > 0 ? (
        <Chip
          label={`Leki ${dosesTaken}/${doses.length}`}
          icon="medication"
          iconColor={colors.danger}
          selected={dosesTaken === doses.length}
          onPress={() => open('leki')}
        />
      ) : null}
      {shown('dom') && choresDue > 0 ? (
        <Chip
          label={`Dom: ${plural(choresDue, ['obowiązek', 'obowiązki', 'obowiązków'])}`}
          icon="home"
          iconColor={colors.notes}
          selected={false}
          onPress={() => open('dom')}
        />
      ) : null}
    </ChipRow>
  );
}
