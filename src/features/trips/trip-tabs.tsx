import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions } from '@/components/bottom-sheet';
import { Button, IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { CheckCircle } from '@/components/check-circle';
import { Chip, ChipRow } from '@/components/chip';
import { EmptyLine } from '@/components/empty-state';
import { ImageViewer } from '@/components/image-viewer';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import { CATEGORIES_SQL, FINANCE_TABLES, type FinanceCategory, type Transaction } from '@/db/finance';
import {
  TRIP_PHOTOS_SQL,
  TRIP_TRANSACTIONS_SQL,
  addTripItems,
  addTripPhoto,
  deleteTripItem,
  deleteTripPhoto,
  toggleTripItem,
  unpackAll,
  updateTripItem,
  type Trip,
  type TripItem,
  type TripPhoto,
} from '@/db/trips';
import { useQuery } from '@/db/use-query';
import { formatMoney, summarize } from '@/features/finance/money';
import { TransactionRow } from '@/features/finance/transaction-row';
import { BarList, Meter } from '@/features/stats/charts';
import { alertPermissionBlocked, confirmDelete } from '@/lib/alerts';
import { WEEKDAYS_SHORT, formatDayLong, relativeDayLabel, weekdayIndex, type DateKey } from '@/lib/dates';
import { capitalize, plural } from '@/lib/format';
import { deleteImageFiles, pickImages } from '@/lib/images';
import { paletteColor } from '@/theme/palette';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import {
  PACKING_TEMPLATES,
  PACK_CATEGORIES,
  newPackingItems,
  packGroups,
  parsePackText,
  planDays,
  tripDates,
  tripDayNumber,
  tripLength,
} from './trips';

/** Pakowanie jeszcze z innych wyjazdów — do „Z poprzedniej podróży”. */
const OTHER_PACK_LISTS_SQL = `
  SELECT i.text, i.category, t.id AS trip_id, t.name, t.icon
  FROM trip_items i JOIN trips t ON t.id = i.trip_id
  WHERE i.kind = 'pack' AND i.trip_id != $trip
  ORDER BY t.start_date DESC, i.sort_order, i.id`;

type OtherPackItem = { text: string; category: string; trip_id: number; name: string; icon: string };

// ——— Pakowanie

export function PackingTab({ trip, items }: { trip: Trip; items: TripItem[] }) {
  const db = useSQLiteContext();
  const { dark } = useTheme();
  const color = paletteColor(trip.color, dark);
  const [adding, setAdding] = useState(false);
  const [templates, setTemplates] = useState(false);
  const packed = items.filter((item) => item.done).length;

  const resetPacking = () =>
    Alert.alert('Odznaczyć wszystko?', 'Lista zostanie, tylko bez zaznaczeń — np. do pakowania na powrót.', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Odznacz', onPress: () => unpackAll(db, trip.id) },
    ]);

  return (
    <>
      {items.length > 0 ? (
        <Card style={styles.progress}>
          <AppText variant="bodyStrong">
            Spakowane {packed} z {items.length}
            {packed === items.length ? ' 🎉' : ''}
          </AppText>
          <Meter value={packed / items.length} color={color} />
        </Card>
      ) : (
        <EmptyLine text="Dodaj rzeczy ręcznie albo zacznij od gotowego szablonu — „Podstawy” i np. „Plaża”." />
      )}

      <ChipRow>
        <Chip label="Dodaj" icon="add" selected={false} onPress={() => setAdding(true)} />
        <Chip label="Z szablonu" icon="library_add" selected={false} onPress={() => setTemplates(true)} />
        {packed > 0 ? <Chip label="Odznacz wszystko" icon="restart_alt" selected={false} onPress={resetPacking} /> : null}
      </ChipRow>

      {packGroups(items).map(([category, group]) => (
        <Section key={category} title={category} meta={`${group.filter((item) => item.done).length}/${group.length}`}>
          {group.map((item) => (
            <PackRow key={item.id} item={item} color={color} />
          ))}
        </Section>
      ))}

      <PackAddSheet visible={adding} trip={trip} items={items} onClose={() => setAdding(false)} />
      <TemplateSheet visible={templates} trip={trip} items={items} onClose={() => setTemplates(false)} />
    </>
  );
}

function PackRow({ item, color }: { item: TripItem; color: string }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  return (
    <Card variant="row" onPress={() => toggleTripItem(db, item)} style={styles.compactRow}>
      <CheckCircle
        checked={Boolean(item.done)}
        onPress={() => toggleTripItem(db, item)}
        color={color}
        accessibilityLabel={item.done ? `Odznacz: ${item.text}` : `Spakowane: ${item.text}`}
      />
      <AppText style={[styles.flex, item.done ? { color: colors.textMuted, textDecorationLine: 'line-through' } : null]}>
        {item.text}
      </AppText>
      <IconButton icon="close" color={colors.textMuted} accessibilityLabel={`Usuń: ${item.text}`} onPress={() => deleteTripItem(db, item.id)} />
    </Card>
  );
}

type SheetProps = { visible: boolean; trip: Trip; items: TripItem[]; onClose: () => void };

function PackAddSheet({ visible, onClose, ...rest }: SheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} gap={spacing.md}>
      <PackAddContent onClose={onClose} {...rest} />
    </BottomSheet>
  );
}

/** Dodawanie rzeczy do spakowania — kilka naraz po przecinku; okno zostaje otwarte do kolejnych. */
function PackAddContent({ trip, items, onClose }: Omit<SheetProps, 'visible'>) {
  const db = useSQLiteContext();
  const [text, setText] = useState('');
  const [category, setCategory] = useState('Ubrania');
  const [added, setAdded] = useState<string[]>([]);

  const add = async () => {
    const texts = parsePackText(text);
    const fresh = newPackingItems(items, texts.map((entry) => ({ text: entry, category })));
    await addTripItems(db, trip.id, fresh);
    setAdded([...added, ...fresh.map((item) => item.text)]);
    setText('');
  };

  return (
    <>
      <AppText variant="heading">Do spakowania</AppText>
      <TextField
        value={text}
        onChangeText={setText}
        placeholder="np. skarpetki, czapka, krem"
        autoFocus
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={add}
      />
      <ChipRow>
        {PACK_CATEGORIES.map((name) => (
          <Chip key={name} label={name} selected={category === name} onPress={() => setCategory(name)} />
        ))}
      </ChipRow>
      <AppText variant="caption" tone="textMuted" numberOfLines={2}>
        {added.length ? `Dodane: ${added.join(', ')}` : 'Kilka rzeczy naraz oddziel przecinkami. Powtórki pomijam.'}
      </AppText>
      <SheetActions>
        <Button label="Gotowe" variant="secondary" onPress={onClose} />
        <Button label="Dodaj" icon="add" onPress={add} disabled={parsePackText(text).length === 0} />
      </SheetActions>
    </>
  );
}

function TemplateSheet({ visible, onClose, ...rest }: SheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} tall gap={spacing.md}>
      <TemplateContent onClose={onClose} {...rest} />
    </BottomSheet>
  );
}

/** Gotowe zestawy i listy z poprzednich wyjazdów; dodaje tylko to, czego jeszcze nie ma. */
function TemplateContent({ trip, items, onClose }: Omit<SheetProps, 'visible'>) {
  const db = useSQLiteContext();
  const { rows: others } = useQuery<OtherPackItem>(OTHER_PACK_LISTS_SQL, { $trip: trip.id }, ['trip_items', 'trips']);
  const otherTrips = [...new Map(others.map((row) => [row.trip_id, row])).values()];

  const sources = [
    ...PACKING_TEMPLATES.map((template) => ({ key: template.key, label: `${template.emoji} ${template.label}`, items: template.items })),
    ...otherTrips.map((other) => ({
      key: `trip:${other.trip_id}`,
      label: `${other.icon} ${other.name}`,
      items: others.filter((row) => row.trip_id === other.trip_id),
    })),
  ];

  return (
    <>
      <View style={styles.sheetHeader}>
        <AppText variant="heading" style={styles.flex}>
          Z szablonu
        </AppText>
        <IconButton icon="close" accessibilityLabel="Zamknij" onPress={onClose} />
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.templates}>
        {sources.map((source, index) => {
          const fresh = newPackingItems(items, source.items);
          const firstTrip = index === PACKING_TEMPLATES.length;
          return (
            <View key={source.key} style={styles.templateBlock}>
              {firstTrip ? (
                <AppText variant="label" tone="textSecondary">
                  Z poprzednich podróży
                </AppText>
              ) : null}
              <Card variant="row">
                <View style={styles.flex}>
                  <AppText>{source.label}</AppText>
                  <AppText variant="caption" tone="textSecondary">
                    {plural(source.items.length, ['rzecz', 'rzeczy', 'rzeczy'])}
                    {fresh.length < source.items.length ? ` · nowych: ${fresh.length}` : ''}
                  </AppText>
                </View>
                <Chip
                  label={fresh.length ? 'Dodaj' : 'Dodane'}
                  icon={fresh.length ? 'add' : 'check'}
                  selected={fresh.length === 0}
                  onPress={() => (fresh.length ? addTripItems(db, trip.id, fresh) : undefined)}
                />
              </Card>
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

// ——— Plan

type PlanTarget = { item?: TripItem; date: DateKey | null };

export function PlanTab({ trip, items, today }: { trip: Trip; items: TripItem[]; today: DateKey }) {
  const db = useSQLiteContext();
  const { dark } = useTheme();
  const color = paletteColor(trip.color, dark);
  const [target, setTarget] = useState<PlanTarget | null>(null);

  return (
    <>
      {planDays(trip, items).map((day) => {
        const title = day.date
          ? `Dzień ${tripDayNumber(trip, day.date)} · ${capitalize(relativeDayLabel(day.date, today) ?? formatDayLong(day.date))}`
          : 'Pomysły i miejsca';
        return (
          <Section key={day.date ?? 'ideas'} title={title} onAdd={() => setTarget({ date: day.date })}>
            {day.date === null && day.items.length === 0 ? (
              <EmptyLine text="Co zobaczyć, gdzie zjeść — bez konkretnego dnia." />
            ) : null}
            {day.items.map((item) => (
              <Card key={item.id} variant="row" onPress={() => setTarget({ item, date: item.date })} style={styles.compactRow}>
                <CheckCircle
                  checked={Boolean(item.done)}
                  onPress={() => toggleTripItem(db, item)}
                  color={color}
                  accessibilityLabel={item.done ? `Cofnij: ${item.text}` : `Zrobione: ${item.text}`}
                />
                {item.time ? <AppText variant="bodyStrong">{item.time}</AppText> : null}
                <AppText style={styles.flex} tone={item.done ? 'textMuted' : 'text'}>
                  {item.text}
                </AppText>
              </Card>
            ))}
          </Section>
        );
      })}
      <PlanSheet target={target} trip={trip} onClose={() => setTarget(null)} />
    </>
  );
}

function PlanSheet({ target, trip, onClose }: { target: PlanTarget | null; trip: Trip; onClose: () => void }) {
  return (
    <BottomSheet visible={target !== null} onClose={onClose} gap={spacing.md}>
      {target ? <PlanContent target={target} trip={trip} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function PlanContent({ target, trip, onClose }: { target: PlanTarget; trip: Trip; onClose: () => void }) {
  const db = useSQLiteContext();
  const [text, setText] = useState(target.item?.text ?? '');
  const [date, setDate] = useState<DateKey | null>(target.date);
  const [time, setTime] = useState<string | null>(target.item?.time ?? null);
  const [timeOpen, setTimeOpen] = useState(false);
  const trimmed = text.trim();

  const save = async () => {
    if (!trimmed) return;
    const planTime = date ? time : null;
    if (target.item) await updateTripItem(db, target.item.id, { text: trimmed, category: '', date, time: planTime });
    else await addTripItems(db, trip.id, [{ kind: 'plan', text: trimmed, category: '', date, time: planTime }]);
    onClose();
  };

  const remove = async () => {
    if (target.item) await deleteTripItem(db, target.item.id);
    onClose();
  };

  return (
    <>
      <AppText variant="heading">{target.item ? 'Punkt planu' : 'Do planu'}</AppText>
      <TextField
        value={text}
        onChangeText={setText}
        placeholder="np. Koloseum, kolacja na Zatybrzu"
        autoFocus={!target.item}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <ChipRow>
        <Chip label="Pomysł" selected={date === null} onPress={() => setDate(null)} />
        {tripDates(trip).map((day, index) => (
          <Chip
            key={day}
            label={`${index + 1} · ${WEEKDAYS_SHORT[weekdayIndex(day)]}`}
            selected={date === day}
            onPress={() => setDate(day)}
          />
        ))}
      </ChipRow>
      {date ? (
        <ChipRow>
          <Chip label="Bez godziny" selected={time === null} onPress={() => setTime(null)} />
          <Chip label={time ?? 'Godzina'} icon="schedule" selected={time !== null} onPress={() => setTimeOpen(true)} />
        </ChipRow>
      ) : null}
      <SheetActions>
        {target.item ? <Button label="Usuń" variant="secondary" icon="delete" onPress={remove} /> : <Button label="Anuluj" variant="secondary" onPress={onClose} />}
        <Button label="Zapisz" onPress={save} disabled={!trimmed} />
      </SheetActions>
      <TimePickerSheet visible={timeOpen} title="Godzina" value={time ?? '10:00'} onChange={setTime} onClose={() => setTimeOpen(false)} />
    </>
  );
}

// ——— Wydatki

export function ExpensesTab({ trip, today }: { trip: Trip; today: DateKey }) {
  const { colors, dark } = useTheme();
  const color = paletteColor(trip.color, dark);
  const { rows: transactions } = useQuery<Transaction>(TRIP_TRANSACTIONS_SQL, { $trip: trip.id }, FINANCE_TABLES);
  const { rows: categories } = useQuery<FinanceCategory>(CATEGORIES_SQL, [], ['finance_categories']);
  const summary = summarize(transactions, categories);
  const spent = summary.expenses;
  const byCategory = summary.byCategory.filter((entry) => entry.amount > 0);
  const over = trip.budget !== null && spent > trip.budget;
  // W trakcie wyjazdu średnia z dni, które już minęły.
  const daysSoFar = today < trip.start_date ? 0 : Math.min(tripLength(trip), tripDayNumber(trip, today));

  const addExpense = () =>
    router.push({
      pathname: '/finanse/transakcja/[id]',
      params: { id: 'nowa', trip: String(trip.id), ...(today >= trip.start_date && today <= trip.end_date ? {} : { date: trip.start_date }) },
    });

  return (
    <>
      <Card style={styles.progress}>
        <AppText variant="caption" tone="textSecondary">
          Wydane na wyjazd
        </AppText>
        <AppText variant="title">{formatMoney(spent)}</AppText>
        {trip.budget ? (
          <>
            <Meter value={spent / trip.budget} color={over ? colors.danger : color} />
            <AppText variant="caption" tone={over ? 'danger' : 'textSecondary'}>
              {over ? `Ponad budżet o ${formatMoney(spent - trip.budget)}` : `Zostało ${formatMoney(trip.budget - spent)} z ${formatMoney(trip.budget)}`}
            </AppText>
          </>
        ) : null}
        {spent > 0 && daysSoFar > 0 ? (
          <AppText variant="caption" tone="textMuted">
            Średnio {formatMoney(Math.round(spent / daysSoFar))} dziennie
          </AppText>
        ) : null}
      </Card>

      <Button label="Dodaj wydatek" icon="add" onPress={addExpense} />

      {byCategory.length > 1 ? (
        <Section title="Na co">
          <BarList
            items={byCategory.map((entry) => ({
              key: String(entry.category?.id ?? 'none'),
              label: entry.category ? `${entry.category.icon} ${entry.category.name}` : 'Bez kategorii',
              value: entry.amount,
              valueLabel: formatMoney(entry.amount),
            }))}
            max={byCategory[0].amount}
            color={color}
          />
        </Section>
      ) : null}

      <Section title="Wpisy">
        {transactions.length === 0 ? (
          <EmptyLine text="Bilety, noclegi, jedzenie — wydatki z tej podróży trafią też do modułu Wydatki." />
        ) : null}
        {transactions.map((transaction) => (
          <TransactionRow key={transaction.id} transaction={transaction} hideTrip />
        ))}
      </Section>
    </>
  );
}

// ——— Zdjęcia i notatki

export function PhotosTab({ trip }: { trip: Trip }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { rows: photos } = useQuery<TripPhoto>(TRIP_PHOTOS_SQL, { $trip: trip.id }, ['trip_photos']);
  const [viewing, setViewing] = useState<TripPhoto | null>(null);

  const addPhotos = async () => {
    const result = await pickImages('trip-photos', 30);
    if (!result) return;
    if ('denied' in result) {
      alertPermissionBlocked('Brak dostępu do zdjęć', 'Zezwól Kaizen na dostęp do zdjęć w ustawieniach telefonu.');
      return;
    }
    for (const uri of result.uris) await addTripPhoto(db, trip.id, uri);
  };

  const removePhoto = (photo: TripPhoto) =>
    confirmDelete('Usunąć zdjęcie?', 'Zniknie tylko z aplikacji — w galerii telefonu zostaje.', async () => {
      await deleteTripPhoto(db, photo.id);
      deleteImageFiles([photo.uri]);
      setViewing(null);
    });

  const editTrip = () => router.push({ pathname: '/podroz/edycja/[id]', params: { id: String(trip.id) } });

  return (
    <>
      {photos.length > 0 ? (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <Pressable key={photo.id} onPress={() => setViewing(photo)} style={styles.photoCell} accessibilityLabel="Pokaż zdjęcie">
              <Image source={{ uri: photo.uri }} style={[styles.photo, { backgroundColor: colors.surfaceAlt }]} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyLine text="Dodaj zdjęcia z wyjazdu — pierwsze będzie okładką podróży na liście." />
      )}
      <Button label="Dodaj zdjęcia" icon="add_photo_alternate" variant="secondary" onPress={addPhotos} />

      <Section title="Notatki i wspomnienia">
        <Card onPress={editTrip}>
          <AppText tone={trip.note ? 'text' : 'textMuted'}>{trip.note || 'Co zapamiętać z tego wyjazdu? Stuknij, żeby dopisać.'}</AppText>
        </Card>
      </Section>

      <ImageViewer image={viewing} onClose={() => setViewing(null)} onDelete={removePhoto} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progress: { gap: spacing.sm },
  compactRow: { paddingVertical: spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center' },
  templates: { gap: spacing.sm, paddingBottom: spacing.xl },
  templateBlock: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  photoCell: { width: '32%', aspectRatio: 1 },
  photo: { flex: 1, borderRadius: radius.sm },
});
