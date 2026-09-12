import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { StackHeader, useListScreenStyle } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { Separator } from '@/components/separator';
import { EXERCISE_SUMMARY_SQL, type ExerciseSummary } from '@/db/exercises';
import { useQuery } from '@/db/use-query';
import { formatDayRelative } from '@/lib/dates';
import { formatDecimal, plural } from '@/lib/format';
import { matchesSearch, normalizeForSearch } from '@/lib/search';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Katalog ćwiczeń z postępami — wejście do historii i rekordów. */
export default function ExercisesScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const listStyle = useListScreenStyle();
  const [search, setSearch] = useState('');
  const { rows, loaded } = useQuery<ExerciseSummary>(EXERCISE_SUMMARY_SQL, [], ['exercises', 'workout_sets', 'workouts']);
  const query = normalizeForSearch(search.trim());
  const visible = query ? rows.filter((row) => matchesSearch(row.name, query)) : rows;

  return (
    <>
      <StackHeader title="Ćwiczenia i rekordy" />
      <FlatList
        {...listStyle}
        data={visible}
        keyExtractor={(row) => String(row.id)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <SearchField value={search} onChangeText={setSearch} placeholder="Szukaj ćwiczenia" />
          </View>
        }
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <Card variant="row" onPress={() => router.push({ pathname: '/cwiczenie/[id]', params: { id: String(item.id) } })}>
            <Icon name="fitness_center" size={20} color={item.sessions ? colors.activity : colors.textMuted} />
            <View style={styles.body}>
              <AppText variant="bodyStrong" tone={item.sessions ? 'text' : 'textSecondary'}>
                {item.name}
              </AppText>
              <AppText variant="caption" tone="textSecondary">
                {item.sessions
                  ? `${plural(item.sessions, ['trening', 'treningi', 'treningów'])} · ostatnio ${
                      item.last_date ? formatDayRelative(item.last_date, today).toLowerCase() : '—'
                    }`
                  : 'Jeszcze nie robione'}
              </AppText>
            </View>
            {item.max_weight ? (
              <AppText variant="bodyStrong">🏆 {formatDecimal(item.max_weight, 1)} kg</AppText>
            ) : null}
          </Card>
        )}
        ListEmptyComponent={loaded ? <EmptyState icon="fitness_center" title="Nic nie znaleziono" color={colors.activity} /> : null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: spacing.lg },
  body: { flex: 1, gap: 2 },
});
