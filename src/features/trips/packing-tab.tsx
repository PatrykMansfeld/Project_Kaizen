import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions, SheetTitle } from '@/components/bottom-sheet';
import { Button, IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { CheckCircle } from '@/components/check-circle';
import { Chip, ChipRow } from '@/components/chip';
import { EmptyLine } from '@/components/empty-state';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { addTripItems, deleteTripItem, toggleTripItem, unpackAll, type Trip, type TripItem } from '@/db/trips';
import { useQuery } from '@/db/use-query';
import { Meter } from '@/features/stats/charts';
import { plural } from '@/lib/format';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { PACKING_TEMPLATES, PACK_CATEGORIES, newPackingItems, packGroups, parsePackText } from './trips';

/** Pakowanie jeszcze z innych wyjazdów — do „Z poprzedniej podróży”. */
const OTHER_PACK_LISTS_SQL = `
  SELECT i.text, i.category, t.id AS trip_id, t.name, t.icon
  FROM trip_items i JOIN trips t ON t.id = i.trip_id
  WHERE i.kind = 'pack' AND i.trip_id != $trip
  ORDER BY t.start_date DESC, i.sort_order, i.id`;

type OtherPackItem = { text: string; category: string; trip_id: number; name: string; icon: string };

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
      <SheetTitle title="Z szablonu" onClose={onClose} />
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progress: { gap: spacing.sm },
  compactRow: { paddingVertical: spacing.sm },
  templates: { gap: spacing.sm, paddingBottom: spacing.xl },
  templateBlock: { gap: spacing.sm },
});
