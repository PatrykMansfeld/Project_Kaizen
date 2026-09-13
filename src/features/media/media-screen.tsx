import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions } from '@/components/bottom-sheet';
import { Button, IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { Chip, ChipRow } from '@/components/chip';
import { DateChoice } from '@/components/date-choice';
import { EmptyState } from '@/components/empty-state';
import { PromptSheet } from '@/components/prompt-sheet';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { StarRating } from '@/components/star-rating';
import { MEDIA_SQL, finishMediaItem, nextEpisode, setBookPage, startMediaItem, type MediaItem, type MediaKind } from '@/db/media';
import { useQuery } from '@/db/use-query';
import { Meter, StatRow, StatTile } from '@/features/stats/charts';
import { addDays, formatDayShort, type DateKey } from '@/lib/dates';
import { plural } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { MEDIA_KINDS, MEDIA_KIND_KEYS, bookProgress, formatRating, mediaYearStats, pickRandom, progressLabel, stars } from './media';

/** Ile ukończonych pokazać przed „Pokaż wszystkie”. */
const DONE_PREVIEW = 8;

/**
 * Kultura — filmy, seriale, anime, książki, manga i gry: co teraz (z postępem), lista „na później”
 * (z losowaniem), ukończone z oceną i rok w liczbach.
 */
export function MediaScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();
  const [kind, setKind] = useState<MediaKind | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [showDropped, setShowDropped] = useState(false);
  const [finishing, setFinishing] = useState<MediaItem | null>(null);
  const [page, setPage] = useState<MediaItem | null>(null);
  const lastPick = useRef<number | null>(null);

  const { rows: items, loaded } = useQuery<MediaItem>(MEDIA_SQL, [], ['media_items']);
  const filtered = kind ? items.filter((item) => item.kind === kind) : items;
  const active = filtered.filter((item) => item.status === 'active');
  const planned = filtered.filter((item) => item.status === 'planned');
  const done = filtered.filter((item) => item.status === 'done');
  const dropped = filtered.filter((item) => item.status === 'dropped');

  const year = Number(today.slice(0, 4));
  const stats = mediaYearStats(filtered, year);
  const breakdown = MEDIA_KIND_KEYS.filter((key) => stats.counts[key] > 0)
    .map((key) => plural(stats.counts[key], MEDIA_KINDS[key].counts))
    .join(' · ');

  const open = (id: number | 'nowy') =>
    router.push({ pathname: '/tytul/[id]', params: { id: String(id), ...(id === 'nowy' && kind ? { kind } : {}) } });

  const suggest = () => {
    const pick = pickRandom(planned, lastPick.current);
    if (!pick) return;
    lastPick.current = pick.id;
    const info = MEDIA_KINDS[pick.kind];
    const details = [info.label, pick.creator, pick.platform, pick.release_year].filter(Boolean).join(' · ');
    Alert.alert(`🎲 ${pick.title}`, details, [
      { text: 'Losuj dalej', onPress: suggest },
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Zaczynam', onPress: () => startMediaItem(db, pick.id, today) },
    ]);
  };

  const savePage = (text: string) => {
    const value = /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN;
    if (!page || !(value >= 0)) {
      Alert.alert('Niepoprawna liczba', 'Wpisz numer strony, np. 120.');
      return;
    }
    void setBookPage(db, page.id, value);
  };

  return (
    <ScrollScreen
      title="Kultura"
      gap={spacing.lg}
      headerRight={<IconButton icon="add" accessibilityLabel="Dodaj tytuł" onPress={() => open('nowy')} />}>
      {loaded && items.length === 0 ? (
        <>
          <EmptyState
            icon="theater_comedy"
            color={colors.journal}
            title="Co obejrzeć, przeczytać, w co zagrać?"
            description="Zapisuj filmy, seriale, anime, książki, mangi i gry, które chcesz poznać. Po skończeniu oceń je gwiazdkami — na koniec roku zobaczysz, co było najlepsze."
          />
          <Button label="Dodaj pierwszy tytuł" icon="add" onPress={() => open('nowy')} />
        </>
      ) : null}

      {items.length > 0 ? (
        <>
          <ChipRow scroll>
            <Chip label="Wszystko" selected={kind === null} onPress={() => setKind(null)} />
            {MEDIA_KIND_KEYS.map((key) => (
              <Chip
                key={key}
                label={`${MEDIA_KINDS[key].emoji} ${MEDIA_KINDS[key].plural}`}
                selected={kind === key}
                onPress={() => setKind(kind === key ? null : key)}
              />
            ))}
          </ChipRow>

          <View style={styles.stats}>
            <StatRow>
              <StatTile label={`Ukończone w ${year}`} value={String(stats.total)} />
              <StatTile label="Średnia ocena" value={stats.averageRating !== null ? formatRating(stats.averageRating) : '—'} />
              <StatTile label="Na liście" value={String(planned.length)} />
            </StatRow>
            {breakdown || stats.best ? (
              <AppText variant="caption" tone="textSecondary">
                {[breakdown, stats.best ? `najlepsze: ${stats.best.title} ${stars(stats.best.rating ?? 0)}` : ''].filter(Boolean).join(' · ')}
              </AppText>
            ) : null}
          </View>

          {active.length > 0 ? (
            <Section title="Teraz" meta={String(active.length)}>
              {active.map((item) => (
                <ActiveCard
                  key={item.id}
                  item={item}
                  onPress={() => open(item.id)}
                  onEpisode={() => nextEpisode(db, item.id)}
                  onPage={() => setPage(item)}
                  onFinish={() => setFinishing(item)}
                />
              ))}
            </Section>
          ) : null}

          <Section
            title="Na liście"
            meta={planned.length > 0 ? String(planned.length) : undefined}
            action={
              planned.length > 1 ? (
                <Pressable onPress={suggest} hitSlop={8} accessibilityRole="button" accessibilityLabel="Wylosuj coś z listy">
                  <AppText variant="caption" tone="accent">
                    🎲 Losuj
                  </AppText>
                </Pressable>
              ) : undefined
            }>
            {planned.length === 0 ? (
              <AppText variant="caption" tone="textMuted">
                Pusto — dopisz coś, co ktoś ci polecił.
              </AppText>
            ) : null}
            {planned.map((item) => (
              <MediaRow
                key={item.id}
                item={item}
                today={today}
                onPress={() => open(item.id)}
                action={
                  item.kind === 'movie'
                    ? { label: MEDIA_KINDS.movie.finishLabel, icon: 'check', onPress: () => setFinishing(item) }
                    : { label: 'Zaczynam', icon: 'play_arrow', onPress: () => startMediaItem(db, item.id, today) }
                }
              />
            ))}
          </Section>

          {done.length > 0 ? (
            <Section title="Ukończone" meta={String(done.length)}>
              {(allDone ? done : done.slice(0, DONE_PREVIEW)).map((item) => (
                <MediaRow key={item.id} item={item} today={today} onPress={() => open(item.id)} />
              ))}
              {done.length > DONE_PREVIEW ? (
                <ToggleLink label={allDone ? 'Pokaż mniej' : `Pokaż wszystkie (${done.length})`} onPress={() => setAllDone(!allDone)} />
              ) : null}
            </Section>
          ) : null}

          {dropped.length > 0 ? (
            <Section
              title={`Porzucone (${dropped.length})`}
              action={<ToggleLink label={showDropped ? 'Zwiń' : 'Pokaż'} onPress={() => setShowDropped(!showDropped)} />}>
              {showDropped
                ? dropped.map((item) => <MediaRow key={item.id} item={item} today={today} onPress={() => open(item.id)} />)
                : null}
            </Section>
          ) : null}
        </>
      ) : null}

      <FinishSheet item={finishing} today={today} onClose={() => setFinishing(null)} />
      <PromptSheet
        visible={page !== null}
        title={page ? `${page.title}: strona` : ''}
        placeholder={page?.total ? `np. 120 (z ${page.total})` : 'np. 120'}
        initialValue={page?.episode ? String(page.episode) : ''}
        keyboardType="number-pad"
        onSubmit={savePage}
        onClose={() => setPage(null)}
      />
    </ScrollScreen>
  );
}

function ToggleLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <AppText variant="caption" tone="accent">
        {label}
      </AppText>
    </Pressable>
  );
}

/** Podpis wiersza: gdzie, rok, postęp albo ocena i data ukończenia. */
function mediaDetail(item: MediaItem, today: DateKey) {
  const parts =
    item.status === 'done'
      ? [item.rating ? stars(item.rating) : null, item.creator, item.finished_on ? formatDayShort(item.finished_on, today) : null]
      : [item.creator, progressLabel(item), item.platform, item.status === 'planned' && item.release_year ? String(item.release_year) : null];
  return parts.filter(Boolean).join(' · ');
}

type RowAction = { label: string; icon: 'check' | 'play_arrow'; onPress: () => void };

function MediaRow({ item, today, onPress, action }: { item: MediaItem; today: DateKey; onPress: () => void; action?: RowAction }) {
  const detail = mediaDetail(item, today);
  return (
    <Card variant="row" onPress={onPress}>
      <AppText style={styles.emoji}>{MEDIA_KINDS[item.kind].emoji}</AppText>
      <View style={styles.flex}>
        <AppText numberOfLines={2} tone={item.status === 'dropped' ? 'textMuted' : 'text'}>
          {item.title}
        </AppText>
        {detail ? (
          <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {action ? <Chip label={action.label} icon={action.icon} selected={false} onPress={action.onPress} /> : null}
    </Card>
  );
}

type ActiveCardProps = { item: MediaItem; onPress: () => void; onEpisode: () => void; onPage: () => void; onFinish: () => void };

/** Tytuł w trakcie: postęp (+1 odcinek / rozdział, strona książki) i „ukończone”. */
function ActiveCard({ item, onPress, onEpisode, onPage, onFinish }: ActiveCardProps) {
  const { colors } = useTheme();
  const info = MEDIA_KINDS[item.kind];
  const detail = [info.statuses.active, progressLabel(item), item.creator, item.platform].filter(Boolean).join(' · ');
  const read = bookProgress(item);
  return (
    <Card onPress={onPress} style={styles.active}>
      <View style={styles.row}>
        <AppText style={styles.emoji}>{info.emoji}</AppText>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {item.title}
          </AppText>
          <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
            {detail}
          </AppText>
        </View>
      </View>
      {read !== null ? <Meter value={read} color={colors.journal} /> : null}
      <ChipRow>
        {info.progress === 'episodes' ? <Chip label="+1 odcinek" icon="add" selected={false} onPress={onEpisode} /> : null}
        {info.progress === 'chapters' ? <Chip label="+1 rozdział" icon="add" selected={false} onPress={onEpisode} /> : null}
        {info.progress === 'pages' ? <Chip label="Strona…" icon="menu_book" selected={false} onPress={onPage} /> : null}
        <Chip label={info.finishLabel} icon="check" selected={false} onPress={onFinish} />
      </ChipRow>
    </Card>
  );
}

/** Okienko „ukończone”: ocena gwiazdkami i dzień. */
function FinishSheet({ item, today, onClose }: { item: MediaItem | null; today: DateKey; onClose: () => void }) {
  return (
    <BottomSheet visible={item !== null} onClose={onClose}>
      {item ? <FinishContent item={item} today={today} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function FinishContent({ item, today, onClose }: { item: MediaItem; today: DateKey; onClose: () => void }) {
  const db = useSQLiteContext();
  const [rating, setRating] = useState<number | null>(item.rating);
  const [date, setDate] = useState<DateKey>(today);

  const save = async () => {
    await finishMediaItem(db, item.id, rating, date);
    onClose();
  };

  return (
    <>
      <View style={styles.sheetTitle}>
        <AppText variant="heading" numberOfLines={2}>
          {MEDIA_KINDS[item.kind].emoji} {item.title}
        </AppText>
        <AppText tone="textSecondary">Jak oceniasz? Stuknij gwiazdkę jeszcze raz, żeby usunąć ocenę.</AppText>
      </View>
      <View style={styles.center}>
        <StarRating value={rating} onChange={setRating} size={44} />
      </View>
      <DateChoice
        value={date}
        onChange={(day) => day && setDate(day)}
        today={today}
        pickerTitle="Kiedy?"
        presets={[
          { label: 'Dziś', date: today },
          { label: 'Wczoraj', date: addDays(today, -1) },
        ]}
      />
      <SheetActions>
        <Button label="Anuluj" variant="secondary" onPress={onClose} />
        <Button label="Zapisz" onPress={save} />
      </SheetActions>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 24, width: 32, textAlign: 'center' },
  stats: { gap: spacing.sm },
  active: { gap: spacing.md },
  sheetTitle: { gap: spacing.xs },
  center: { alignItems: 'center' },
});
