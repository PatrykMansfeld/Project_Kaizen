import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Chip, ChipRow } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { EXERCISE_HISTORY_SQL } from '@/db/exercises';
import { useQuery } from '@/db/use-query';
import { RECORD_LABELS, personalRecords, summarizeSessions, type ExerciseSetRow, type Session } from '@/features/activity/records';
import { StatRow, StatTile } from '@/features/stats/charts';
import { LineChart } from '@/features/stats/line-chart';
import { diffDays, formatDayShort } from '@/lib/dates';
import { formatDecimal, plural } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { useTheme } from '@/theme/use-theme';

type Metric = 'weight' | 'e1rm' | 'volume' | 'reps';

const METRICS: { key: Metric; label: string; value: (session: Session) => number | null; unit: string }[] = [
  { key: 'weight', label: 'Ciężar', value: (s) => s.maxWeight, unit: 'kg' },
  { key: 'e1rm', label: '1RM', value: (s) => s.bestE1rm, unit: 'kg' },
  { key: 'volume', label: 'Objętość', value: (s) => s.volume || null, unit: 'kg' },
  { key: 'reps', label: 'Powtórzenia', value: (s) => s.maxReps || null, unit: 'powt.' },
];

/** Postęp w ćwiczeniu: rekordy, wykres i historia treningów (/cwiczenie/3). */
export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = Number(id);
  const today = useToday();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  const { rows: nameRows } = useQuery<{ name: string }>('SELECT name FROM exercises WHERE id = ?', [exerciseId], ['exercises']);
  const { rows, loaded } = useQuery<ExerciseSetRow>(
    EXERCISE_HISTORY_SQL,
    { $exercise: exerciseId, $exclude: -1 },
    ['workout_sets', 'workouts'],
  );
  const sessions = summarizeSessions(rows);
  const records = personalRecords(sessions);
  const weighted = sessions.some((session) => session.maxWeight !== null);
  const [metric, setMetric] = useState<Metric>('weight');
  const activeMetric = METRICS.find((item) => item.key === (weighted ? metric : 'reps'))!;
  const points = sessions
    .map((session) => ({ session, value: activeMetric.value(session) }))
    .filter((point): point is { session: Session; value: number } => point.value !== null);
  const selectedSession = sessions.find((session) => String(session.workoutId) === selected);
  const format = (value: number) => (activeMetric.key === 'reps' ? String(value) : formatDecimal(value, 1));

  return (
    <ScrollScreen title={nameRows[0]?.name ?? 'Ćwiczenie'}>
      {loaded && sessions.length === 0 ? (
        <EmptyState
          icon="fitness_center"
          color={colors.activity}
          title="Brak historii"
          description="Dodaj to ćwiczenie do treningu siłowego, a tu pojawią się postępy i rekordy."
        />
      ) : null}

      {records.length > 0 ? (
        <StatRow>
          {records
            .filter((record) => (weighted ? record.kind !== 'reps' : record.kind === 'reps'))
            .slice(0, 3)
            .map((record) => (
              <StatTile
                key={record.kind}
                label={RECORD_LABELS[record.kind]}
                value={`${record.kind === 'reps' ? record.value : formatDecimal(record.value, 1)}${record.kind === 'reps' ? '' : ' kg'}`}
                detail={formatDayShort(record.date, today)}
              />
            ))}
        </StatRow>
      ) : null}

      {points.length > 0 ? (
        <Card>
          {weighted ? (
            <ChipRow>
              {METRICS.filter((item) => item.key !== 'reps').map((item) => (
                <Chip key={item.key} label={item.label} selected={metric === item.key} onPress={() => setMetric(item.key)} />
              ))}
            </ChipRow>
          ) : null}
          <AppText variant="caption" tone="textSecondary">
            {selectedSession
              ? `${formatDayShort(selectedSession.date, today)}: ${format(activeMetric.value(selectedSession) ?? 0)} ${activeMetric.unit}`
              : `${activeMetric.label} (${activeMetric.unit}) w kolejnych treningach — stuknij wykres`}
          </AppText>
          <LineChart
            points={points.map(({ session, value }) => ({
              key: String(session.workoutId),
              x: diffDays(points[0].session.date, session.date),
              y: value,
            }))}
            color={colors.activity}
            selectedKey={selected}
            onSelect={setSelected}
            formatValue={format}
          />
        </Card>
      ) : null}

      {sessions.length > 0 ? (
        <Section title={`Historia (${plural(sessions.length, ['trening', 'treningi', 'treningów'])})`}>
          {[...sessions].reverse().map((session) => (
            <Card
              key={session.workoutId}
              variant="row"
              onPress={() => router.push({ pathname: '/trening/[id]', params: { id: String(session.workoutId) } })}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{formatDayShort(session.date, today)}</AppText>
                <AppText variant="caption" tone="textSecondary">
                  {session.sets.map((set) => `${set.reps ?? '?'}${set.weight ? ` × ${formatDecimal(set.weight, 1)}` : ''}`).join(', ')}
                </AppText>
              </View>
              {session.maxWeight ? <AppText variant="bodyStrong">{formatDecimal(session.maxWeight, 1)} kg</AppText> : null}
            </Card>
          ))}
        </Section>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
});
