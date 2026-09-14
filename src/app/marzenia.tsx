import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions, SheetTitle } from '@/components/bottom-sheet';
import { Button, IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { Chip, ChipRow } from '@/components/chip';
import { DateChoice, recentDayPresets } from '@/components/date-choice';
import { EmojiBadge } from '@/components/emoji-badge';
import { EmptyState } from '@/components/empty-state';
import { PhotoField, usePhotoDraft } from '@/components/photo-field';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { DREAMS_SQL, markDreamDone, type Dream, type DreamCategory } from '@/db/dreams';
import { useQuery } from '@/db/use-query';
import { DREAM_CATEGORIES, DREAM_CATEGORY_KEYS, dreamsSummary, targetLabel } from '@/features/dreams/dreams';
import { Meter } from '@/features/stats/charts';
import { formatDayShort, type DateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Lista marzeń: rzeczy do zrobienia w życiu — przed tobą i spełnione (ze zdjęciem). */
export default function DreamsScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const [category, setCategory] = useState<DreamCategory | null>(null);
  const [fulfilling, setFulfilling] = useState<Dream | null>(null);
  const { rows: dreams, loaded } = useQuery<Dream>(DREAMS_SQL, [], ['dreams']);

  const year = Number(today.slice(0, 4));
  const summary = dreamsSummary(dreams, year);
  const filtered = category ? dreams.filter((dream) => dream.category === category) : dreams;
  const open = filtered.filter((dream) => dream.done_on === null);
  const done = filtered.filter((dream) => dream.done_on !== null);
  const usedCategories = DREAM_CATEGORY_KEYS.filter((key) => dreams.some((dream) => dream.category === key));

  const edit = (id: number | 'nowe') =>
    router.push({ pathname: '/marzenie/[id]', params: { id: String(id), ...(id === 'nowe' && category ? { category } : {}) } });

  return (
    <ScrollScreen
      title="Lista marzeń"
      gap={spacing.lg}
      headerRight={<IconButton icon="add" accessibilityLabel="Dodaj marzenie" onPress={() => edit('nowe')} />}>
      {loaded && dreams.length === 0 ? (
        <>
          <EmptyState
            icon="auto_awesome"
            color={colors.journal}
            title="Co chcesz zrobić w życiu?"
            description="Zapisz marzenia — duże i małe: miejsca, przygody, umiejętności. Kiedy któreś się spełni, dodaj zdjęcie na pamiątkę."
          />
          <Button label="Dodaj pierwsze marzenie" icon="add" onPress={() => edit('nowe')} />
        </>
      ) : null}

      {dreams.length > 0 ? (
        <>
          <Card style={styles.summary}>
            <AppText variant="heading">
              ✨ Spełnione {summary.done} z {summary.total}
            </AppText>
            <Meter value={summary.total ? summary.done / summary.total : 0} color={colors.journal} />
            <AppText variant="caption" tone="textSecondary">
              {summary.doneThisYear ? `W tym roku: ${summary.doneThisYear}. ` : ''}Każde spełnione marzenie to +50 XP w Postępie.
            </AppText>
          </Card>

          {usedCategories.length > 1 ? (
            <ChipRow scroll>
              <Chip label="Wszystkie" selected={category === null} onPress={() => setCategory(null)} />
              {usedCategories.map((key) => (
                <Chip
                  key={key}
                  label={`${DREAM_CATEGORIES[key].emoji} ${DREAM_CATEGORIES[key].label}`}
                  selected={category === key}
                  onPress={() => setCategory(category === key ? null : key)}
                />
              ))}
            </ChipRow>
          ) : null}

          <Section title="Przed tobą" meta={open.length ? String(open.length) : undefined}>
            {open.length === 0 ? (
              <AppText variant="caption" tone="textMuted">
                Wszystko spełnione — czas na nowe marzenie.
              </AppText>
            ) : null}
            {open.map((dream) => (
              <OpenDreamRow key={dream.id} dream={dream} year={year} onPress={() => edit(dream.id)} onDone={() => setFulfilling(dream)} />
            ))}
          </Section>

          {done.length > 0 ? (
            <Section title="Spełnione" meta={String(done.length)}>
              {done.map((dream) => (
                <DoneDreamCard key={dream.id} dream={dream} today={today} onPress={() => edit(dream.id)} />
              ))}
            </Section>
          ) : null}
        </>
      ) : null}

      <BottomSheet visible={fulfilling !== null} onClose={() => setFulfilling(null)}>
        {fulfilling ? <FulfillContent dream={fulfilling} today={today} onClose={() => setFulfilling(null)} /> : null}
      </BottomSheet>
    </ScrollScreen>
  );
}

function OpenDreamRow({ dream, year, onPress, onDone }: { dream: Dream; year: number; onPress: () => void; onDone: () => void }) {
  const { colors } = useTheme();
  const target = targetLabel(dream.target_year, year);
  const detail = [DREAM_CATEGORIES[dream.category].label, target].filter(Boolean).join(' · ');
  const late = dream.target_year !== null && dream.target_year < year;
  return (
    <Card variant="row" onPress={onPress}>
      <EmojiBadge emoji={dream.icon} color={colors.journal} size={40} />
      <View style={styles.flex}>
        <AppText numberOfLines={2}>{dream.title}</AppText>
        <AppText variant="caption" tone={late ? 'warning' : 'textSecondary'} numberOfLines={1}>
          {detail}
        </AppText>
      </View>
      <Chip label="Spełnione" icon="check" selected={false} onPress={onDone} />
    </Card>
  );
}

function DoneDreamCard({ dream, today, onPress }: { dream: Dream; today: DateKey; onPress: () => void }) {
  const { colors } = useTheme();
  const [broken, setBroken] = useState(false);
  const photo = dream.photo_uri && !broken ? dream.photo_uri : null;
  return (
    <Card onPress={onPress} style={[styles.doneCard, photo ? styles.noPadding : null]}>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={[styles.photo, { backgroundColor: colors.surfaceAlt }]}
          contentFit="cover"
          onError={() => setBroken(true)}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={[styles.doneText, photo ? styles.padded : null]}>
        <AppText style={styles.doneEmoji}>{dream.icon}</AppText>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {dream.title}
          </AppText>
          <AppText variant="caption" tone="textSecondary">
            Spełnione {formatDayShort(dream.done_on!, today)}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

/** „Spełnione!”: dzień i zdjęcie na pamiątkę. */
function FulfillContent({ dream, today, onClose }: { dream: Dream; today: DateKey; onClose: () => void }) {
  const db = useSQLiteContext();
  const [date, setDate] = useState<DateKey>(today);
  const photo = usePhotoDraft('dream-photos');

  const save = async () => {
    await markDreamDone(db, dream.id, date, photo.uri);
    photo.commit(photo.uri);
    onClose();
  };

  return (
    <>
      <SheetTitle title={`${dream.icon} ${dream.title}`} subtitle="Gratulacje! Kiedy to się stało?" />
      <DateChoice
        value={date}
        onChange={(day) => day && setDate(day)}
        today={today}
        pickerTitle="Kiedy?"
        presets={recentDayPresets(today)}
      />
      <PhotoField uri={photo.uri} onPick={photo.pick} onRemove={photo.remove} emptyLabel="Dodaj zdjęcie na pamiątkę" />
      <SheetActions>
        <Button label="Anuluj" variant="secondary" onPress={onClose} />
        <Button label="Spełnione ✨" onPress={save} />
      </SheetActions>
    </>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  doneCard: { gap: spacing.md, overflow: 'hidden' },
  noPadding: { padding: 0 },
  padded: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  photo: { width: '100%', aspectRatio: 16 / 9 },
  doneText: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  doneEmoji: { fontSize: 24, width: 32, textAlign: 'center' },
});
