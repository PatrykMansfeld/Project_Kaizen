import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { ColorSwatches } from '@/components/color-swatches';
import { EmojiBadge } from '@/components/emoji-badge';
import { EmojiPicker } from '@/components/emoji-picker';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import {
  createCategory,
  deleteCategory,
  getCategory,
  updateCategory,
  type TransactionType,
} from '@/db/finance';
import { FINANCE_ICONS } from '@/features/finance/finance-icons';
import { moneyInputText, parseMoney } from '@/features/finance/money';
import { confirmDelete } from '@/lib/alerts';
import { useEditRecord } from '@/lib/use-edit-record';
import { PALETTE, PALETTE_KEYS, paletteColor, type PaletteKey } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Form = { name: string; icon: string; color: PaletteKey; type: TransactionType; budget: string };

/** Nowa kategoria: /finanse/kategoria/nowa (?type=income), edycja: /finanse/kategoria/3. */
export default function FinanceCategoryEditScreen() {
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const isNew = params.id === 'nowa';
  const categoryId = Number(params.id);

  const db = useSQLiteContext();
  const { dark } = useTheme();
  const [form, setForm] = useState<Form>({
    name: '',
    icon: FINANCE_ICONS[0],
    color: 'teal',
    type: params.type === 'income' ? 'income' : 'expense',
    budget: '',
  });

  const loaded = useEditRecord(isNew ? null : categoryId, () => getCategory(db, categoryId), (category) => {
    setForm({
      name: category.name,
      icon: category.icon,
      color: (category.color in PALETTE ? category.color : 'teal') as PaletteKey,
      type: category.type,
      budget: category.monthly_budget ? moneyInputText(category.monthly_budget) : '',
    });
  });

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const budget = parseMoney(form.budget);
  const budgetValid = form.type === 'income' || budget === null || (!Number.isNaN(budget) && budget > 0);
  const canSave = loaded && form.name.trim().length > 0 && budgetValid;
  const color = paletteColor(form.color, dark);

  const save = async () => {
    if (!canSave) return;
    const input = {
      name: form.name.trim(),
      icon: form.icon,
      color: form.color,
      type: form.type,
      monthly_budget: form.type === 'expense' && budget ? budget : null,
    };
    if (isNew) await createCategory(db, input);
    else await updateCategory(db, categoryId, input);
    router.back();
  };

  const remove = () =>
    confirmDelete('Usunąć kategorię?', 'Wpisy z tej kategorii zostaną — jako „Bez kategorii”.', async () => {
      await deleteCategory(db, categoryId);
      router.back();
    });

  return (
    <ScrollScreen
      title={isNew ? 'Nowa kategoria' : 'Kategoria'}
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
            placeholder="np. Kawa na mieście"
            autoFocus={isNew}
            maxLength={30}
          />

          <Section title="Rodzaj">
            <ChipRow>
              <Chip label="Wydatki" selected={form.type === 'expense'} onPress={() => update({ type: 'expense' })} />
              <Chip label="Przychody" selected={form.type === 'income'} onPress={() => update({ type: 'income' })} />
            </ChipRow>
          </Section>

          {form.type === 'expense' ? (
            <View style={styles.field}>
              <TextField
                label="Limit miesięczny (zł, opcjonalnie)"
                value={form.budget}
                onChangeText={(text) => update({ budget: text })}
                placeholder="np. 800"
                keyboardType="decimal-pad"
                maxLength={12}
              />
              {!budgetValid ? (
                <AppText variant="caption" tone="danger">
                  Wpisz kwotę, np. 800 albo 450,50
                </AppText>
              ) : null}
            </View>
          ) : null}

          <Section title="Kolor">
            <ColorSwatches
              swatches={PALETTE_KEYS.map((key) => ({ key, label: PALETTE[key].label, color: paletteColor(key, dark) }))}
              value={form.color}
              onChange={(key) => update({ color: key })}
              checkColor="#FFFFFF"
            />
          </Section>

          <Section title="Ikona">
            <EmojiPicker options={FINANCE_ICONS} value={form.icon} onChange={(icon) => update({ icon })} color={color} />
          </Section>

          {!isNew ? <Button label="Usuń kategorię" variant="danger" icon="delete" onPress={remove} /> : null}
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center' },
  field: { gap: spacing.sm },
});
