import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { DateChoice } from '@/components/date-choice';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { createWarranty, deleteWarranty, getWarranty, updateWarranty } from '@/db/home';
import { moneyInputText, parseMoney } from '@/features/finance/money';
import { warrantyLabel } from '@/features/home/home';
import { confirmDelete } from '@/lib/alerts';
import { addMonths, type DateKey } from '@/lib/dates';
import { useEditRecord } from '@/lib/use-edit-record';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';

type Form = { name: string; purchaseDate: DateKey | null; expiresOn: DateKey; price: string; store: string; note: string };

/** Nowa gwarancja: /dom/gwarancja/nowa, edycja: /dom/gwarancja/2. */
export default function WarrantyEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowa';
  const warrantyId = Number(id);

  const db = useSQLiteContext();
  const today = useToday();
  const [form, setForm] = useState<Form>({
    name: '',
    purchaseDate: today,
    expiresOn: addMonths(today, 24),
    price: '',
    store: '',
    note: '',
  });

  const loaded = useEditRecord(isNew ? null : warrantyId, () => getWarranty(db, warrantyId), (warranty) => {
    setForm({
      name: warranty.name,
      purchaseDate: warranty.purchase_date,
      expiresOn: warranty.expires_on,
      price: warranty.price ? moneyInputText(warranty.price) : '',
      store: warranty.store,
      note: warranty.note,
    });
  });

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const price = parseMoney(form.price);
  const priceValid = price === null || (!Number.isNaN(price) && price > 0);
  const canSave = loaded && form.name.trim().length > 0 && priceValid;
  const base = form.purchaseDate ?? today;

  const save = async () => {
    if (!canSave) return;
    const input = {
      name: form.name.trim(),
      purchase_date: form.purchaseDate,
      expires_on: form.expiresOn,
      price,
      store: form.store.trim(),
      note: form.note.trim(),
    };
    if (isNew) await createWarranty(db, input);
    else await updateWarranty(db, warrantyId, input);
    router.back();
  };

  const remove = () =>
    confirmDelete('Usunąć gwarancję?', form.name, async () => {
      await deleteWarranty(db, warrantyId);
      router.back();
    });

  return (
    <ScrollScreen
      title={isNew ? 'Nowa gwarancja' : 'Gwarancja'}
      headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
      {loaded ? (
        <>
          <TextField
            label="Rzecz"
            value={form.name}
            onChangeText={(name) => update({ name })}
            placeholder="np. Pralka Bosch, Laptop"
            autoFocus={isNew}
            maxLength={60}
          />

          <Section title="Data zakupu">
            <DateChoice
              value={form.purchaseDate}
              onChange={(date) => update({ purchaseDate: date })}
              today={today}
              pickerTitle="Data zakupu"
              presets={[
                { label: 'Nie pamiętam', date: null },
                { label: 'Dziś', date: today },
              ]}
            />
          </Section>

          <Section title="Gwarancja do">
            <DateChoice
              value={form.expiresOn}
              onChange={(date) => date && update({ expiresOn: date })}
              today={today}
              pickerTitle="Koniec gwarancji"
              presets={[
                { label: '1 rok', date: addMonths(base, 12) },
                { label: '2 lata', date: addMonths(base, 24) },
                { label: '3 lata', date: addMonths(base, 36) },
                { label: '5 lat', date: addMonths(base, 60) },
              ]}
            />
            <AppText variant="caption" tone="textMuted">
              {warrantyLabel(form.expiresOn, today)} · przypomnę miesiąc przed końcem
            </AppText>
          </Section>

          <View style={styles.field}>
            <TextField
              label="Cena (zł, opcjonalnie)"
              value={form.price}
              onChangeText={(text) => update({ price: text })}
              placeholder="np. 1899"
              keyboardType="decimal-pad"
              maxLength={12}
            />
            {!priceValid ? (
              <AppText variant="caption" tone="danger">
                Wpisz kwotę, np. 1899,99
              </AppText>
            ) : null}
          </View>
          <TextField label="Sklep" value={form.store} onChangeText={(store) => update({ store })} placeholder="np. Media Expert" maxLength={60} />
          <TextField
            label="Notatka"
            value={form.note}
            onChangeText={(note) => update({ note })}
            placeholder="np. numer seryjny, gdzie leży paragon"
            multiline
          />

          {!isNew ? <Button label="Usuń gwarancję" variant="danger" icon="delete" onPress={remove} /> : null}
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
});
