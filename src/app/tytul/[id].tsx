import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { DateChoice } from '@/components/date-choice';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { StarRating } from '@/components/star-rating';
import { TextField } from '@/components/text-field';
import { createMediaItem, deleteMediaItem, getMediaItem, updateMediaItem, type MediaKind, type MediaStatus } from '@/db/media';
import { MEDIA_KINDS, MEDIA_KIND_KEYS, MEDIA_STATUSES, isMediaKind, normalizeMedia } from '@/features/media/media';
import { confirmDelete } from '@/lib/alerts';
import { addDays, type DateKey } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';

type Form = {
  kind: MediaKind;
  title: string;
  creator: string;
  status: MediaStatus;
  rating: number | null;
  platform: string;
  year: string;
  season: string;
  episode: string;
  total: string;
  startedOn: DateKey | null;
  finishedOn: DateKey | null;
  note: string;
};

/** Liczba z pola (tylko cyfry) albo null. */
function parseCount(text: string) {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

/** Pola postępu: sezon i odcinek (serial, anime) albo tom i rozdział (manga); książka ma stronę i liczbę stron. */
const PROGRESS_FIELDS = {
  episodes: { major: { label: 'Sezon', placeholder: '1' }, minor: { label: 'Ostatni odcinek', placeholder: '0' } },
  chapters: { major: { label: 'Tom', placeholder: 'opcjonalnie' }, minor: { label: 'Ostatni rozdział', placeholder: '0' } },
} as const;

/** Nowy tytuł: /tytul/nowy (opcjonalnie ?kind=book), edycja: /tytul/4. */
export default function MediaEditScreen() {
  const params = useLocalSearchParams<{ id: string; kind?: string }>();
  const isNew = params.id === 'nowy';
  const itemId = Number(params.id);

  const db = useSQLiteContext();
  const today = useToday();
  const [form, setForm] = useState<Form>({
    kind: isMediaKind(params.kind) ? params.kind : 'movie',
    title: '',
    creator: '',
    status: 'planned',
    rating: null,
    platform: '',
    year: '',
    season: '',
    episode: '',
    total: '',
    startedOn: null,
    finishedOn: null,
    note: '',
  });
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    getMediaItem(db, itemId).then((item) => {
      if (!item) {
        router.back();
        return;
      }
      setForm({
        kind: item.kind,
        title: item.title,
        creator: item.creator,
        status: item.status,
        rating: item.rating,
        platform: item.platform,
        year: item.release_year ? String(item.release_year) : '',
        season: item.season ? String(item.season) : '',
        episode: item.episode ? String(item.episode) : '',
        total: item.total ? String(item.total) : '',
        startedOn: item.started_on,
        finishedOn: item.finished_on,
        note: item.note,
      });
      setLoaded(true);
    });
  }, [db, isNew, itemId]);

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const info = MEDIA_KINDS[form.kind];
  const year = parseCount(form.year);
  const yearValid = form.year.trim() === '' || (year !== null && year >= 1000 && year <= 2200);
  const canSave = loaded && form.title.trim().length > 0 && yearValid;
  const started = form.status !== 'planned';
  const counted = info.progress === 'episodes' || info.progress === 'chapters' ? PROGRESS_FIELDS[info.progress] : null;

  const save = async () => {
    if (!canSave) return;
    const season = parseCount(form.season);
    const total = parseCount(form.total);
    const input = normalizeMedia(
      {
        kind: form.kind,
        title: form.title,
        creator: form.creator,
        status: form.status,
        rating: form.rating,
        platform: form.platform,
        release_year: year,
        season: season && season > 0 ? season : null,
        episode: parseCount(form.episode),
        total: total && total > 0 ? total : null,
        started_on: form.startedOn,
        finished_on: form.finishedOn,
        note: form.note,
      },
      today,
    );
    if (isNew) await createMediaItem(db, input);
    else await updateMediaItem(db, itemId, input);
    router.back();
  };

  const remove = () =>
    confirmDelete('Usunąć tytuł?', undefined, async () => {
      await deleteMediaItem(db, itemId);
      router.back();
    });

  return (
    <ScrollScreen
      title={isNew ? 'Nowy tytuł' : info.label}
      headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
      {loaded ? (
        <>
          <ChipRow>
            {MEDIA_KIND_KEYS.map((key) => (
              <Chip
                key={key}
                label={`${MEDIA_KINDS[key].emoji} ${MEDIA_KINDS[key].label}`}
                selected={form.kind === key}
                onPress={() => update({ kind: key })}
              />
            ))}
          </ChipRow>

          <TextField
            label="Tytuł"
            value={form.title}
            onChangeText={(title) => update({ title })}
            placeholder={info.example}
            autoFocus={isNew}
            maxLength={120}
          />
          {info.creatorLabel ? (
            <TextField
              label={info.creatorLabel}
              value={form.creator}
              onChangeText={(creator) => update({ creator })}
              placeholder={form.kind === 'manga' ? 'np. Kentarō Miura' : 'np. Bolesław Prus'}
              maxLength={80}
            />
          ) : null}

          <Section title="Status">
            <ChipRow>
              {MEDIA_STATUSES.map((status) => (
                <Chip
                  key={status}
                  label={info.statuses[status]}
                  selected={form.status === status}
                  onPress={() => update({ status, finishedOn: status === 'done' ? (form.finishedOn ?? today) : form.finishedOn })}
                />
              ))}
            </ChipRow>
          </Section>

          {counted && started ? (
            <View style={styles.pair}>
              <View style={styles.flex}>
                <TextField
                  label={counted.major.label}
                  value={form.season}
                  onChangeText={(season) => update({ season })}
                  placeholder={counted.major.placeholder}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              <View style={styles.flex}>
                <TextField
                  label={counted.minor.label}
                  value={form.episode}
                  onChangeText={(episode) => update({ episode })}
                  placeholder={counted.minor.placeholder}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>
          ) : null}
          {info.progress === 'pages' ? (
            <View style={styles.pair}>
              {started ? (
                <View style={styles.flex}>
                  <TextField
                    label="Strona"
                    value={form.episode}
                    onChangeText={(episode) => update({ episode })}
                    placeholder="0"
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
              ) : null}
              <View style={styles.flex}>
                <TextField
                  label="Liczba stron"
                  value={form.total}
                  onChangeText={(total) => update({ total })}
                  placeholder="opcjonalnie"
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            </View>
          ) : null}

          {form.status === 'done' ? (
            <>
              <Section title="Ocena">
                <StarRating value={form.rating} onChange={(rating) => update({ rating })} />
              </Section>
              <Section title="Kiedy">
                <DateChoice
                  value={form.finishedOn ?? today}
                  onChange={(finishedOn) => finishedOn && update({ finishedOn })}
                  today={today}
                  pickerTitle="Kiedy?"
                  presets={[
                    { label: 'Dziś', date: today },
                    { label: 'Wczoraj', date: addDays(today, -1) },
                  ]}
                />
              </Section>
            </>
          ) : null}

          <Section title={info.platformLabel}>
            <ChipRow>
              {info.platforms.map((platform) => (
                <Chip
                  key={platform}
                  label={platform}
                  selected={form.platform === platform}
                  onPress={() => update({ platform: form.platform === platform ? '' : platform })}
                />
              ))}
            </ChipRow>
            <TextField
              value={form.platform}
              onChangeText={(platform) => update({ platform })}
              placeholder="albo wpisz własne"
              maxLength={40}
            />
          </Section>

          <TextField
            label="Rok premiery"
            value={form.year}
            onChangeText={(text) => update({ year: text })}
            placeholder={form.kind === 'book' ? 'np. 1890 (opcjonalnie)' : 'np. 2024 (opcjonalnie)'}
            keyboardType="number-pad"
            maxLength={4}
          />
          {!yearValid ? (
            <AppText variant="caption" tone="danger">
              Wpisz rok, np. 2024.
            </AppText>
          ) : null}

          <TextField
            label="Notatka"
            value={form.note}
            onChangeText={(note) => update({ note })}
            placeholder="Wrażenia, kto polecił, ulubiona scena…"
            multiline
          />

          {!isNew ? <Button label="Usuń tytuł" variant="danger" icon="delete" onPress={remove} /> : null}
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
