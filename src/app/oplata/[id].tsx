import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { ColorSwatches } from '@/components/color-swatches';
import { DateChoice } from '@/components/date-choice';
import { EmojiBadge } from '@/components/emoji-badge';
import { EmojiPicker } from '@/components/emoji-picker';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { BILL_PAYMENTS_SQL, createBill, deleteBill, getBill, updateBill, type BillFrequency } from '@/db/bills';
import { CATEGORIES_SQL, type FinanceCategory, type Transaction } from '@/db/finance';
import { useQuery } from '@/db/use-query';
import { FREQUENCIES, FREQUENCY_KEYS } from '@/features/bills/bills';
import { FINANCE_ICONS } from '@/features/finance/finance-icons';
import { moneyInputText, parseMoney } from '@/features/finance/money';
import { TransactionRow } from '@/features/finance/transaction-row';
import { requestPermissionOrWarn } from '@/features/reminders/permission';
import { EXPO_GO_NOTICE, notificationsSupported } from '@/features/reminders/reminders';
import { confirmDelete } from '@/lib/alerts';
import { addMonths, fromDateKey, toDateKey, type DateKey } from '@/lib/dates';
import { useEditRecord } from '@/lib/use-edit-record';
import { useToday } from '@/lib/use-today';
import { PALETTE, PALETTE_KEYS, paletteColor, type PaletteKey } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const REMINDERS: { days: number | null; label: string }[] = [
  { days: null, label: 'Bez przypomnienia' },
  { days: 0, label: 'W dniu terminu' },
  { days: 1, label: 'Dzień wcześniej' },
  { days: 3, label: '3 dni wcześniej' },
  { days: 7, label: 'Tydzień wcześniej' },
];

type Form = {
  name: string;
  icon: string;
  color: PaletteKey;
  amount: string;
  frequency: BillFrequency;
  nextDue: DateKey;
  categoryId: number | null;
  remind: number | null;
  active: boolean;
  note: string;
};

/** Nowa opłata: /oplata/nowa, edycja: /oplata/4. */
export default function BillEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowa';
  const billId = Number(id);

  const db = useSQLiteContext();
  const today = useToday();
  const { dark } = useTheme();
  const { rows: categories } = useQuery<FinanceCategory>(CATEGORIES_SQL, [], ['finance_categories']);
  const { rows: payments } = useQuery<Transaction>(BILL_PAYMENTS_SQL, { $bill: isNew ? -1 : billId }, ['transactions']);
  const firstOfNextMonth = toDateKey(new Date(fromDateKey(today).getFullYear(), fromDateKey(today).getMonth() + 1, 1));

  const [form, setForm] = useState<Form>({
    name: '',
    icon: '💡',
    color: 'yellow',
    amount: '',
    frequency: 'monthly',
    nextDue: firstOfNextMonth,
    categoryId: null,
    remind: 1,
    active: true,
    note: '',
  });

  const loaded = useEditRecord(isNew ? null : billId, () => getBill(db, billId), (bill) => {
    setForm({
      name: bill.name,
      icon: bill.icon,
      color: (bill.color in PALETTE ? bill.color : 'yellow') as PaletteKey,
      amount: moneyInputText(bill.amount),
      frequency: bill.frequency,
      nextDue: bill.next_due,
      categoryId: bill.category_id,
      remind: bill.remind_days_before,
      active: bill.active === 1,
      note: bill.note,
    });
  });

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const amount = parseMoney(form.amount);
  const amountValid = amount !== null && !Number.isNaN(amount) && amount > 0;
  const canSave = loaded && form.name.trim().length > 0 && amountValid;
  const color = paletteColor(form.color, dark);

  const setRemind = (remind: number | null) => {
    update({ remind });
    if (remind !== null) {
      void requestPermissionOrWarn(
        'Opłata zostanie zapisana, ale przypomnienie nie przyjdzie, dopóki nie włączysz powiadomień w ustawieniach telefonu.',
      );
    }
  };

  const save = async () => {
    if (!canSave || amount === null) return;
    const input = {
      name: form.name.trim(),
      icon: form.icon,
      color: form.color,
      amount,
      frequency: form.frequency,
      next_due: form.nextDue,
      category_id: form.categoryId,
      remind_days_before: form.remind,
      active: form.active,
      note: form.note.trim(),
    };
    if (isNew) await createBill(db, input);
    else await updateBill(db, billId, input);
    router.back();
  };

  const remove = () =>
    confirmDelete('Usunąć opłatę?', 'Zapisane płatności zostaną w Wydatkach.', async () => {
      await deleteBill(db, billId);
      router.back();
    });

  return (
    <ScrollScreen
      title={isNew ? 'Nowa opłata' : 'Stała opłata'}
      headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
      {loaded ? (
        <>
          <View style={styles.preview}>
            <EmojiBadge emoji={form.icon} color={color} size={72} />
          </View>

          <TextField
            label="Nazwa"
            value={form.name}
            onChangeText={(name) => update({ name })}
            placeholder="np. Czynsz, Netflix, Telefon"
            autoFocus={isNew}
            maxLength={40}
          />

          <View style={styles.field}>
            <TextField
              label="Kwota (zł)"
              value={form.amount}
              onChangeText={(text) => update({ amount: text })}
              placeholder="np. 49,99"
              keyboardType="decimal-pad"
              maxLength={12}
            />
            {form.amount && !amountValid ? (
              <AppText variant="caption" tone="danger">
                Wpisz kwotę, np. 49,99
              </AppText>
            ) : null}
          </View>

          <Section title="Jak często">
            <ChipRow>
              {FREQUENCY_KEYS.map((frequency) => (
                <Chip
                  key={frequency}
                  label={FREQUENCIES[frequency].label}
                  selected={form.frequency === frequency}
                  onPress={() => update({ frequency })}
                />
              ))}
            </ChipRow>
          </Section>

          <Section title="Najbliższy termin">
            <DateChoice
              value={form.nextDue}
              onChange={(date) => date && update({ nextDue: date })}
              today={today}
              pickerTitle="Najbliższy termin"
              presets={[
                { label: 'Dziś', date: today },
                { label: '1. dzień miesiąca', date: firstOfNextMonth },
                { label: 'Za miesiąc', date: addMonths(today, 1) },
              ]}
            />
          </Section>

          <Section title="Przypomnienie (9:00)">
            <ChipRow>
              {REMINDERS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  icon={option.days !== null ? 'notifications' : undefined}
                  selected={form.remind === option.days}
                  onPress={() => setRemind(option.days)}
                />
              ))}
            </ChipRow>
            {form.remind !== null && !notificationsSupported ? (
              <AppText variant="caption" tone="textMuted">
                {EXPO_GO_NOTICE}
              </AppText>
            ) : null}
          </Section>

          <Section title="Kategoria w Wydatkach">
            <ChipRow>
              <Chip label="Bez kategorii" selected={form.categoryId === null} onPress={() => update({ categoryId: null })} />
              {categories
                .filter((category) => category.type === 'expense')
                .map((category) => (
                  <Chip
                    key={category.id}
                    label={`${category.icon} ${category.name}`}
                    selected={form.categoryId === category.id}
                    onPress={() => update({ categoryId: category.id })}
                  />
                ))}
            </ChipRow>
          </Section>

          <Section title="Ikona">
            <EmojiPicker options={FINANCE_ICONS} value={form.icon} onChange={(icon) => update({ icon })} color={color} />
          </Section>

          <Section title="Kolor">
            <ColorSwatches
              swatches={PALETTE_KEYS.map((key) => ({ key, label: PALETTE[key].label, color: paletteColor(key, dark) }))}
              value={form.color}
              onChange={(key) => update({ color: key })}
              checkColor="#FFFFFF"
            />
          </Section>

          <TextField
            label="Notatka"
            value={form.note}
            onChangeText={(note) => update({ note })}
            placeholder="np. numer konta, do kiedy umowa (opcjonalnie)"
            multiline
          />

          {!isNew ? (
            <>
              <ChipRow>
                <Chip
                  label={form.active ? 'Aktywna' : 'Wstrzymana'}
                  icon={form.active ? 'play_arrow' : 'pause'}
                  selected={!form.active}
                  onPress={() => update({ active: !form.active })}
                />
              </ChipRow>
              {payments.length > 0 ? (
                <Section title={`Historia płatności (${payments.length})`}>
                  {payments.slice(0, 12).map((payment) => (
                    <TransactionRow key={payment.id} transaction={payment} />
                  ))}
                </Section>
              ) : null}
              <Button label="Usuń opłatę" variant="danger" icon="delete" onPress={remove} />
            </>
          ) : null}
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center' },
  field: { gap: spacing.sm },
});
