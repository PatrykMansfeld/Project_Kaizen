import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { DateChoice, recentDayPresets } from '@/components/date-choice';
import { EmojiPicker } from '@/components/emoji-picker';
import { HeaderTextButton } from '@/components/header';
import { PhotoField, usePhotoDraft } from '@/components/photo-field';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { createDream, deleteDream, getDream, updateDream, type DreamCategory } from '@/db/dreams';
import { DREAM_CATEGORIES, DREAM_CATEGORY_KEYS, DREAM_ICONS, isDreamCategory } from '@/features/dreams/dreams';
import { confirmDelete } from '@/lib/alerts';
import { type DateKey } from '@/lib/dates';
import { parseWholeNumber } from '@/lib/format';
import { useEditRecord } from '@/lib/use-edit-record';
import { useToday } from '@/lib/use-today';
import { useTheme } from '@/theme/use-theme';

type Form = {
  title: string;
  icon: string;
  category: DreamCategory;
  year: string;
  note: string;
  doneOn: DateKey | null;
};

/** Nowe marzenie: /marzenie/nowe (opcjonalnie ?category=travel), edycja: /marzenie/3. */
export default function DreamEditScreen() {
  const params = useLocalSearchParams<{ id: string; category?: string }>();
  const isNew = params.id === 'nowe';
  const dreamId = Number(params.id);
  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();
  const initialCategory = isDreamCategory(params.category) ? params.category : 'other';

  const [form, setForm] = useState<Form>({
    title: '',
    icon: DREAM_CATEGORIES[initialCategory].emoji,
    category: initialCategory,
    year: '',
    note: '',
    doneOn: null,
  });
  const photo = usePhotoDraft('dream-photos');

  const loaded = useEditRecord(isNew ? null : dreamId, () => getDream(db, dreamId), (dream) => {
    setForm({
      title: dream.title,
      icon: dream.icon,
      category: dream.category,
      year: dream.target_year ? String(dream.target_year) : '',
      note: dream.note,
      doneOn: dream.done_on,
    });
    photo.load(dream.photo_uri);
  });

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const year = parseWholeNumber(form.year);
  const yearValid = form.year.trim() === '' || (year !== null && year >= 2000 && year <= 2200);
  const canSave = loaded && form.title.trim().length > 0 && yearValid;
  const currentYear = Number(today.slice(0, 4));

  // Zmiana kategorii podmienia emoji, jeśli było domyślne dla poprzedniej.
  const setCategory = (category: DreamCategory) =>
    update({ category, icon: form.icon === DREAM_CATEGORIES[form.category].emoji ? DREAM_CATEGORIES[category].emoji : form.icon });

  const save = async () => {
    if (!canSave) return;
    const saved = form.doneOn ? photo.uri : null;
    const input = {
      title: form.title.trim(),
      icon: form.icon,
      category: form.category,
      target_year: year,
      note: form.note.trim(),
      done_on: form.doneOn,
      photo_uri: saved,
    };
    if (isNew) await createDream(db, input);
    else await updateDream(db, dreamId, input);
    photo.commit(saved);
    router.back();
  };

  const remove = () =>
    confirmDelete('Usunąć marzenie?', undefined, async () => {
      await deleteDream(db, dreamId);
      photo.discardAll();
      router.back();
    });

  return (
    <ScrollScreen
      title={isNew ? 'Nowe marzenie' : 'Marzenie'}
      headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
      {loaded ? (
        <>
          <TextField
            label="Marzenie"
            value={form.title}
            onChangeText={(title) => update({ title })}
            placeholder={DREAM_CATEGORIES[form.category].example}
            autoFocus={isNew}
            maxLength={120}
          />

          <Section title="Rodzaj">
            <ChipRow>
              {DREAM_CATEGORY_KEYS.map((key) => (
                <Chip
                  key={key}
                  label={`${DREAM_CATEGORIES[key].emoji} ${DREAM_CATEGORIES[key].label}`}
                  selected={form.category === key}
                  onPress={() => setCategory(key)}
                />
              ))}
            </ChipRow>
          </Section>

          <Section title="Ikona">
            <EmojiPicker options={DREAM_ICONS} value={form.icon} onChange={(icon) => update({ icon })} color={colors.journal} />
          </Section>

          <Section title="Do kiedy">
            <ChipRow>
              <Chip label="Bez terminu" selected={form.year === ''} onPress={() => update({ year: '' })} />
              {[0, 1, 2, 5].map((offset) => (
                <Chip
                  key={offset}
                  label={offset === 0 ? 'W tym roku' : String(currentYear + offset)}
                  selected={year === currentYear + offset}
                  onPress={() => update({ year: String(currentYear + offset) })}
                />
              ))}
            </ChipRow>
            <TextField
              value={form.year}
              onChangeText={(text) => update({ year: text.replace(/\D/g, '') })}
              placeholder="albo wpisz rok, np. 2030"
              keyboardType="number-pad"
              maxLength={4}
            />
            {!yearValid ? (
              <AppText variant="caption" tone="danger">
                Wpisz rok, np. 2030.
              </AppText>
            ) : null}
          </Section>

          <TextField
            label="Notatka"
            value={form.note}
            onChangeText={(note) => update({ note })}
            placeholder="Dlaczego tego chcesz, z kim, pierwszy krok…"
            multiline
          />

          <Section title="Spełnione">
            <ChipRow>
              <Chip label="Jeszcze nie" selected={form.doneOn === null} onPress={() => update({ doneOn: null })} />
              <Chip label="Spełnione ✨" selected={form.doneOn !== null} onPress={() => update({ doneOn: form.doneOn ?? today })} />
            </ChipRow>
            {form.doneOn ? (
              <>
                <DateChoice
                  value={form.doneOn}
                  onChange={(doneOn) => doneOn && update({ doneOn })}
                  today={today}
                  pickerTitle="Kiedy?"
                  presets={recentDayPresets(today)}
                />
                <PhotoField uri={photo.uri} onPick={photo.pick} onRemove={photo.remove} emptyLabel="Dodaj zdjęcie na pamiątkę" />
              </>
            ) : null}
          </Section>

          {!isNew ? <Button label="Usuń marzenie" variant="danger" icon="delete" onPress={remove} /> : null}
        </>
      ) : null}
    </ScrollScreen>
  );
}
