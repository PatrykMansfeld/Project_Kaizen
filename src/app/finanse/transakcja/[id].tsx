import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { DateChoice } from '@/components/date-choice';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import {
  CATEGORIES_SQL,
  createTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction,
  type FinanceCategory,
  type TransactionType,
} from '@/db/finance';
import { useQuery } from '@/db/use-query';
import { moneyInputText, parseMoney } from '@/features/finance/money';
import { confirmDelete } from '@/lib/alerts';
import { addDays, isDateKey, type DateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';

type Form = { type: TransactionType; amount: string; categoryId: number | null; date: DateKey; note: string };

/** Nowy wpis: /finanse/transakcja/nowa (opcjonalnie ?type=income&date=…), edycja: /finanse/transakcja/12. */
export default function TransactionEditScreen() {
  const params = useLocalSearchParams<{ id: string; type?: string; date?: string }>();
  const isNew = params.id === 'nowa';
  const transactionId = Number(params.id);

  const db = useSQLiteContext();
  const today = useToday();
  const { rows: categories } = useQuery<FinanceCategory>(CATEGORIES_SQL, [], ['finance_categories']);

  const [form, setForm] = useState<Form>({
    type: params.type === 'income' ? 'income' : 'expense',
    amount: '',
    categoryId: null,
    date: isDateKey(params.date) ? params.date : today,
    note: '',
  });
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    getTransaction(db, transactionId).then((transaction) => {
      if (!transaction) {
        router.back();
        return;
      }
      setForm({
        type: transaction.type,
        amount: moneyInputText(transaction.amount),
        categoryId: transaction.category_id,
        date: transaction.date,
        note: transaction.note,
      });
      setLoaded(true);
    });
  }, [db, isNew, transactionId]);

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const amount = parseMoney(form.amount);
  const amountValid = amount !== null && !Number.isNaN(amount) && amount > 0;
  const canSave = loaded && amountValid;
  const typeCategories = categories.filter((category) => category.type === form.type);

  // Zmiana rodzaju czyści kategorię z drugiego rodzaju (wydatek nie trafi do „Wypłaty”).
  const setType = (type: TransactionType) =>
    update({
      type,
      categoryId: categories.some((category) => category.id === form.categoryId && category.type === type) ? form.categoryId : null,
    });

  const save = async () => {
    if (!canSave || amount === null) return;
    const input = { type: form.type, amount, category_id: form.categoryId, date: form.date, note: form.note.trim() };
    if (isNew) await createTransaction(db, input);
    else await updateTransaction(db, transactionId, input);
    router.back();
  };

  const remove = () =>
    confirmDelete(form.type === 'expense' ? 'Usunąć wydatek?' : 'Usunąć przychód?', undefined, async () => {
      await deleteTransaction(db, transactionId);
      router.back();
    });

  const title = form.type === 'expense' ? (isNew ? 'Nowy wydatek' : 'Wydatek') : isNew ? 'Nowy przychód' : 'Przychód';

  return (
    <ScrollScreen title={title} headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
      {loaded ? (
        <>
          <ChipRow>
            <Chip label="Wydatek" icon="remove" selected={form.type === 'expense'} onPress={() => setType('expense')} />
            <Chip label="Przychód" icon="add" selected={form.type === 'income'} onPress={() => setType('income')} />
          </ChipRow>

          <TextField
            label="Kwota (zł)"
            value={form.amount}
            onChangeText={(text) => update({ amount: text })}
            placeholder="np. 45,90"
            keyboardType="decimal-pad"
            maxLength={12}
            autoFocus={isNew}
          />
          {form.amount && !amountValid ? (
            <AppText variant="caption" tone="danger">
              Wpisz kwotę, np. 45 albo 45,90
            </AppText>
          ) : null}

          <Section title="Kategoria">
            <ChipRow>
              <Chip label="Bez kategorii" selected={form.categoryId === null} onPress={() => update({ categoryId: null })} />
              {typeCategories.map((category) => (
                <Chip
                  key={category.id}
                  label={`${category.icon} ${category.name}`}
                  selected={form.categoryId === category.id}
                  onPress={() => update({ categoryId: category.id })}
                />
              ))}
              <Chip
                label="Nowa kategoria"
                icon="add"
                selected={false}
                onPress={() =>
                  router.push({ pathname: '/finanse/kategoria/[id]', params: { id: 'nowa', type: form.type } })
                }
              />
            </ChipRow>
          </Section>

          <Section title="Data">
            <DateChoice
              value={form.date}
              onChange={(date) => date && update({ date })}
              today={today}
              pickerTitle="Data"
              presets={[
                { label: 'Dziś', date: today },
                { label: 'Wczoraj', date: addDays(today, -1) },
              ]}
            />
          </Section>

          <TextField
            label="Opis"
            value={form.note}
            onChangeText={(note) => update({ note })}
            placeholder={form.type === 'expense' ? 'np. Biedronka, paliwo (opcjonalnie)' : 'np. premia (opcjonalnie)'}
            returnKeyType="done"
          />

          {!isNew ? (
            <Button
              label={form.type === 'expense' ? 'Usuń wydatek' : 'Usuń przychód'}
              variant="danger"
              icon="delete"
              onPress={remove}
            />
          ) : null}
        </>
      ) : null}
    </ScrollScreen>
  );
}
