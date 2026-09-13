import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';

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
import { TRIP_OPTIONS_SQL, type Trip } from '@/db/trips';
import { useQuery } from '@/db/use-query';
import { moneyInputText, parseMoney } from '@/features/finance/money';
import { useModuleVisible } from '@/features/modules/preferences';
import { tripOnDate, tripOptionsForDate } from '@/features/trips/trips';
import { confirmDelete } from '@/lib/alerts';
import { addDays, isDateKey, type DateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';

type Form = { type: TransactionType; amount: string; categoryId: number | null; date: DateKey; note: string; tripId: number | null };

/**
 * Nowy wpis: /finanse/transakcja/nowa (opcjonalnie ?type=income&date=…&trip=3), edycja: /finanse/transakcja/12.
 * Nowy wydatek z dnia trwającej podróży sam się do niej przypisuje (widać to i można zmienić).
 */
export default function TransactionEditScreen() {
  const params = useLocalSearchParams<{ id: string; type?: string; date?: string; trip?: string }>();
  const isNew = params.id === 'nowa';
  const transactionId = Number(params.id);
  const tripParam = params.trip && /^\d+$/.test(params.trip) ? Number(params.trip) : null;

  const db = useSQLiteContext();
  const today = useToday();
  const tripsVisible = useModuleVisible('podroze');
  const { rows: categories } = useQuery<FinanceCategory>(CATEGORIES_SQL, [], ['finance_categories']);
  const { rows: trips, loaded: tripsLoaded } = useQuery<Trip>(TRIP_OPTIONS_SQL, [], ['trips']);

  const [form, setForm] = useState<Form>({
    type: params.type === 'income' ? 'income' : 'expense',
    amount: '',
    categoryId: null,
    date: isDateKey(params.date) ? params.date : today,
    note: '',
    tripId: tripParam,
  });
  const [loaded, setLoaded] = useState(isNew);
  const tripTouched = useRef(tripParam !== null || !isNew);

  // Nowy wydatek w trakcie wyjazdu — domyślnie należy do tej podróży.
  useEffect(() => {
    if (!tripsLoaded || tripTouched.current || !tripsVisible) return;
    tripTouched.current = true;
    const ongoing = tripOnDate(trips, form.date);
    if (ongoing) setForm((current) => ({ ...current, tripId: ongoing.id }));
  }, [tripsLoaded, trips, form.date, tripsVisible]);

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
        tripId: transaction.trip_id,
      });
      setLoaded(true);
    });
  }, [db, isNew, transactionId]);

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const amount = parseMoney(form.amount);
  const amountValid = amount !== null && !Number.isNaN(amount) && amount > 0;
  const canSave = loaded && amountValid;
  const typeCategories = categories.filter((category) => category.type === form.type);
  const tripOptions = tripOptionsForDate(trips, form.date, form.tripId);

  // Zmiana rodzaju czyści kategorię z drugiego rodzaju (wydatek nie trafi do „Wypłaty”).
  const setType = (type: TransactionType) =>
    update({
      type,
      categoryId: categories.some((category) => category.id === form.categoryId && category.type === type) ? form.categoryId : null,
    });

  const save = async () => {
    if (!canSave || amount === null) return;
    const input = {
      type: form.type,
      amount,
      category_id: form.categoryId,
      date: form.date,
      note: form.note.trim(),
      trip_id: form.tripId,
    };
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

          {tripOptions.length > 0 && (tripsVisible || form.tripId !== null) ? (
            <Section title="Podróż">
              <ChipRow>
                <Chip label="Bez podróży" selected={form.tripId === null} onPress={() => update({ tripId: null })} />
                {tripOptions.map((trip) => (
                  <Chip
                    key={trip.id}
                    label={`${trip.icon} ${trip.name}`}
                    selected={form.tripId === trip.id}
                    onPress={() => update({ tripId: trip.id })}
                  />
                ))}
              </ChipRow>
            </Section>
          ) : null}

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
