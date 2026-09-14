import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { PeriodNavigator } from '@/components/period-navigator';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { MEDIA_SQL, type MediaItem } from '@/db/media';
import { useQuery } from '@/db/use-query';
import { MEDIA_KINDS, MEDIA_KIND_KEYS, formatRating, formatScore, formatTimeSpent, mediaYearReport } from '@/features/media/media';
import { MediaThumb } from '@/features/media/media-thumb';
import { BarList, ColumnChart, StatRow, StatTile } from '@/features/stats/charts';
import { MONTHS } from '@/lib/dates';
import { plural } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Rok w kulturze (/kultura-rok?rok=2026): ile, jak dobrze, ile czasu, ulubione gatunki i najlepsze tytuły. */
export default function MediaYearScreen() {
  const params = useLocalSearchParams<{ rok?: string }>();
  const today = useToday();
  const { colors } = useTheme();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(() => {
    const value = Number(params.rok);
    return Number.isInteger(value) && value >= 1900 && value <= currentYear ? value : currentYear;
  });
  const { rows: items, loaded } = useQuery<MediaItem>(MEDIA_SQL, [], ['media_items']);
  const report = mediaYearReport(items, year, currentYear);
  const breakdown = MEDIA_KIND_KEYS.filter((key) => report.counts[key] > 0)
    .map((key) => `${MEDIA_KINDS[key].emoji} ${plural(report.counts[key], MEDIA_KINDS[key].counts)}`)
    .join(' · ');

  const timeItems = MEDIA_KIND_KEYS.filter((key) => report.minutesByKind[key] > 0).map((key) => ({
    key,
    label: MEDIA_KINDS[key].plural,
    value: report.minutesByKind[key],
    valueLabel: formatTimeSpent(report.minutesByKind[key]),
  }));
  const genreItems = report.genres.slice(0, 8).map((stat) => ({
    key: stat.genre,
    label: stat.genre,
    value: stat.count,
    valueLabel: stat.average !== null ? `${stat.count} · ${formatRating(stat.average)}` : String(stat.count),
  }));
  const ratingMax = Math.max(...report.ratings, 1);
  const monthMax = Math.max(...report.months, 1);

  return (
    <ScrollScreen title="Rok w kulturze">
      <PeriodNavigator
        title={String(year)}
        onPrevious={() => setYear(year - 1)}
        onNext={() => setYear(year + 1)}
        canGoNext={year < currentYear}
        unitLabel={{ previous: 'Poprzedni rok', next: 'Następny rok' }}
      />

      {loaded && report.total === 0 ? (
        <EmptyState
          icon="theater_comedy"
          color={colors.journal}
          title={`W ${year} nic nie zostało ukończone`}
          description="Tu pojawi się podsumowanie: najlepsze tytuły, czas, ulubione gatunki i najbardziej kulturalny miesiąc."
        />
      ) : null}

      {report.total > 0 ? (
        <>
          <Card style={styles.hero}>
            <AppText variant="title">{plural(report.total, ['tytuł', 'tytuły', 'tytułów'])}</AppText>
            <AppText tone="textSecondary">{breakdown}</AppText>
          </Card>

          <StatRow>
            <StatTile label="Średnia ocena" value={report.averageRating !== null ? formatRating(report.averageRating) : '—'} />
            <StatTile
              label="Czas"
              value={report.minutes > 0 ? formatTimeSpent(report.minutes) : '—'}
              detail={report.activeMinutes > 0 ? `+ ${formatTimeSpent(report.activeMinutes)} w trakcie` : undefined}
            />
            <StatTile
              label={report.pages > 0 ? 'Strony' : 'Rozdziały'}
              value={report.pages > 0 ? String(report.pages) : report.chapters > 0 ? String(report.chapters) : '—'}
              detail={report.pages > 0 && report.chapters > 0 ? `i ${report.chapters} rozdz. mangi` : undefined}
            />
          </StatRow>

          {report.top.length > 0 ? (
            <Section title="Najlepsze">
              {report.top.map((item, index) => (
                <Card
                  key={item.id}
                  variant="row"
                  onPress={() => router.push({ pathname: '/tytul/[id]', params: { id: String(item.id) } })}>
                  <AppText variant="heading" style={styles.position}>
                    {MEDALS[index] ?? index + 1}
                  </AppText>
                  <MediaThumb item={item} size="small" />
                  <View style={styles.flex}>
                    <AppText numberOfLines={2}>{item.title}</AppText>
                    <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
                      {`★ ${formatScore(item.rating ?? 0)} · ${MEDIA_KINDS[item.kind].label}`}
                    </AppText>
                  </View>
                </Card>
              ))}
            </Section>
          ) : null}

          <Section
            title="Miesiące"
            meta={report.bestMonth ? `najwięcej: ${MONTHS[report.bestMonth.month]} (${report.bestMonth.count})` : undefined}>
            <Card>
              <ColumnChart
                columns={report.months.map((count, index) => ({
                  key: String(index),
                  value: count,
                  valueLabel: String(count),
                  axisLabel: index % 2 === 0 ? MONTHS[index].slice(0, 3) : undefined,
                  accessibilityLabel: `${MONTHS[index]}: ${count}`,
                }))}
                max={monthMax}
                color={colors.journal}
                showValues
              />
            </Card>
          </Section>

          {timeItems.length > 0 ? (
            <Section title="Czas">
              <Card style={styles.gap}>
                <BarList items={timeItems} max={Math.max(...timeItems.map((item) => item.value))} color={colors.journal} />
                {report.longest ? (
                  <AppText variant="caption" tone="textSecondary">
                    Najdłużej: {report.longest.item.title} ({formatTimeSpent(report.longest.minutes)})
                  </AppText>
                ) : null}
              </Card>
            </Section>
          ) : null}

          {report.averageRating !== null ? (
            <Section title="Oceny">
              <Card>
                <ColumnChart
                  columns={report.ratings.slice(1).map((count, index) => ({
                    key: String(index + 1),
                    value: count,
                    valueLabel: String(count),
                    axisLabel: String(index + 1),
                    accessibilityLabel: `Ocena ${index + 1}: ${count}`,
                  }))}
                  max={ratingMax}
                  color={colors.warning}
                  showValues
                />
              </Card>
            </Section>
          ) : null}

          {genreItems.length > 0 ? (
            <Section title="Gatunki">
              <Card style={styles.gap}>
                <BarList items={genreItems} max={genreItems[0].value} color={colors.journal} />
                {report.favoriteGenre ? (
                  <AppText variant="caption" tone="textSecondary">
                    Najwyżej oceniasz: {report.favoriteGenre.genre} ({formatRating(report.favoriteGenre.average!)})
                  </AppText>
                ) : null}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.xs },
  position: { width: 32, textAlign: 'center' },
  flex: { flex: 1, gap: 2 },
  gap: { gap: spacing.md },
});
