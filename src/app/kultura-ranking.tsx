import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions, SheetTitle } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip, ChipRow } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextLink } from '@/components/text-link';
import { MEDIA_SQL, resetRanking, saveDuel, type MediaItem, type MediaKind } from '@/db/media';
import { useQuery } from '@/db/use-query';
import { MEDIA_KINDS, MEDIA_KIND_KEYS, formatScore, isMediaKind } from '@/features/media/media';
import { MediaThumb } from '@/features/media/media-thumb';
import { duelResult, eloOf, pickDuel, rankItems } from '@/features/media/ranking';
import { plural } from '@/lib/format';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Ranking ulubionych w danym rodzaju (/kultura-ranking?rodzaj=movie) — z trybem „co lepsze?”. */
export default function MediaRankingScreen() {
  const params = useLocalSearchParams<{ rodzaj?: string }>();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { rows: items, loaded } = useQuery<MediaItem>(MEDIA_SQL, [], ['media_items']);
  const done = items.filter((item) => item.status === 'done');
  const kinds = MEDIA_KIND_KEYS.filter((key) => done.some((item) => item.kind === key));
  // Domyślnie rodzaj z parametru, a bez niego — ten z największą liczbą ukończonych.
  const busiest = [...kinds].sort((a, b) => done.filter((i) => i.kind === b).length - done.filter((i) => i.kind === a).length)[0];
  const [picked, setPicked] = useState<MediaKind | null>(isMediaKind(params.rodzaj) ? params.rodzaj : null);
  const kind = picked && kinds.includes(picked) ? picked : (busiest ?? null);
  const ranked = kind ? rankItems(done.filter((item) => item.kind === kind)) : [];
  const duels = Math.round(ranked.reduce((sum, item) => sum + item.duels, 0) / 2);
  const [dueling, setDueling] = useState(false);

  const reset = () =>
    kind &&
    Alert.alert('Zacząć ranking od nowa?', 'Porównania znikną, a kolejność znów będzie wynikać z ocen.', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Od nowa', style: 'destructive', onPress: () => void resetRanking(db, kind) },
    ]);

  return (
    <ScrollScreen title="Ranking">
      {loaded && kinds.length === 0 ? (
        <EmptyState
          icon="leaderboard"
          color={colors.journal}
          title="Jeszcze nie ma czego układać"
          description="Ranking powstaje z ukończonych tytułów. Oznacz coś jako obejrzane, przeczytane albo ukończone i oceń."
        />
      ) : null}

      {kind ? (
        <>
          <ChipRow scroll>
            {kinds.map((key) => (
              <Chip
                key={key}
                label={`${MEDIA_KINDS[key].emoji} ${MEDIA_KINDS[key].plural}`}
                selected={kind === key}
                onPress={() => setPicked(key)}
              />
            ))}
          </ChipRow>

          <Card style={styles.intro}>
            <AppText variant="heading">⚔️ Co lepsze?</AppText>
            <AppText tone="textSecondary">
              Porównuj tytuły parami — kolejność ułoży się sama. Na start liczy się ocena, a każde porównanie ją dopracowuje.
            </AppText>
            {ranked.length >= 2 ? (
              <Button label="Porównuj" icon="compare_arrows" onPress={() => setDueling(true)} />
            ) : (
              <AppText variant="caption" tone="textMuted">
                Do porównań potrzeba co najmniej dwóch ukończonych tytułów.
              </AppText>
            )}
          </Card>

          <Section
            title={`Top · ${MEDIA_KINDS[kind].plural}`}
            meta={duels > 0 ? plural(duels, ['porównanie', 'porównania', 'porównań']) : undefined}>
            {ranked.map((item, index) => (
              <Card key={item.id} variant="row" onPress={() => router.push({ pathname: '/tytul/[id]', params: { id: String(item.id) } })}>
                <AppText variant="heading" style={styles.position}>
                  {MEDALS[index] ?? index + 1}
                </AppText>
                <MediaThumb item={item} size="small" />
                <View style={styles.flex}>
                  <AppText numberOfLines={2}>{item.title}</AppText>
                  <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
                    {[item.rating ? `★ ${formatScore(item.rating)}` : 'bez oceny', item.release_year].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
              </Card>
            ))}
            {duels > 0 ? <TextLink label="Zacznij ranking od nowa" onPress={reset} /> : null}
          </Section>

          <BottomSheet visible={dueling} onClose={() => setDueling(false)}>
            {dueling ? <DuelContent items={ranked} onClose={() => setDueling(false)} /> : null}
          </BottomSheet>
        </>
      ) : null}
    </ScrollScreen>
  );
}

/**
 * Porównania jedno po drugim. Wynik zapisujemy od razu, a kolejną parę wybieramy z lokalnie
 * poprawionych punktów (odświeżona lista z bazy mogłaby jeszcze nie dotrzeć).
 */
function DuelContent({ items, onClose }: { items: MediaItem[]; onClose: () => void }) {
  const db = useSQLiteContext();
  const [scores, setScores] = useState<Map<number, { elo: number; duels: number }>>(new Map());
  const current = items.map((item) => ({ ...item, ...scores.get(item.id) }));
  const [pair, setPair] = useState(() => pickDuel(current, null));
  const [count, setCount] = useState(0);

  const next = (updated: typeof current, previous: [number, number]) => setPair(pickDuel(updated, previous));

  const choose = (winner: MediaItem, loser: MediaItem) => {
    const result = duelResult(eloOf(winner), eloOf(loser));
    const nextScores = new Map(scores);
    nextScores.set(winner.id, { elo: result.winner, duels: winner.duels + 1 });
    nextScores.set(loser.id, { elo: result.loser, duels: loser.duels + 1 });
    setScores(nextScores);
    setCount(count + 1);
    void saveDuel(db, { id: winner.id, elo: result.winner }, { id: loser.id, elo: result.loser });
    next(
      items.map((item) => ({ ...item, ...nextScores.get(item.id) })),
      [winner.id, loser.id],
    );
  };

  if (!pair) return null;
  const [left, right] = pair;

  return (
    <>
      <SheetTitle
        title="Co lepsze?"
        subtitle={count > 0 ? `Stuknij lepszy tytuł · w tej sesji ${plural(count, ['porównanie', 'porównania', 'porównań'])}` : 'Stuknij tytuł, który podobał ci się bardziej.'}
      />
      <View style={styles.duel}>
        <DuelOption item={left} onPress={() => choose(left, right)} />
        <AppText variant="heading" tone="textMuted">
          vs
        </AppText>
        <DuelOption item={right} onPress={() => choose(right, left)} />
      </View>
      <SheetActions>
        <Button label="Pomiń" variant="secondary" onPress={() => next(current, [left.id, right.id])} />
        <Button label="Gotowe" onPress={onClose} />
      </SheetActions>
    </>
  );
}

function DuelOption({ item, onPress }: { item: MediaItem; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Lepsze: ${item.title}`}
      android_ripple={{ color: colors.border }}
      style={[styles.option, { backgroundColor: colors.surfaceAlt }]}>
      <MediaThumb item={item} size="huge" />
      <AppText variant="bodyStrong" numberOfLines={3} style={styles.center}>
        {item.title}
      </AppText>
      <AppText variant="caption" tone="textSecondary">
        {item.rating ? `★ ${formatScore(item.rating)}` : 'bez oceny'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.sm },
  position: { width: 32, textAlign: 'center' },
  flex: { flex: 1, gap: 2 },
  duel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  option: { flex: 1, alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, minHeight: 230 },
  center: { textAlign: 'center' },
});
