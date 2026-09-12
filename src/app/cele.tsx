import { router } from 'expo-router';
import { SectionList, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { StackHeader, useListScreenStyle } from '@/components/screen';
import { Separator } from '@/components/separator';
import { GOALS_SQL, type Goal } from '@/db/goals';
import { useQuery } from '@/db/use-query';
import { GoalCard } from '@/features/goals/goal-card';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';

/** Cele długoterminowe: trwające i zakończone. */
export default function GoalsScreen() {
  const today = useToday();
  const listStyle = useListScreenStyle();
  const { rows: goals, loaded } = useQuery<Goal>(GOALS_SQL, { $today: today }, ['goals']);

  const open = (id: number | 'nowy') => router.push({ pathname: '/cel/[id]', params: { id: String(id) } });
  const sections = [
    { title: 'Trwające', data: goals.filter((goal) => goal.end_date >= today) },
    { title: 'Zakończone', data: goals.filter((goal) => goal.end_date < today) },
  ].filter((section) => section.data.length > 0);

  return (
    <>
      <StackHeader title="Cele" headerRight={<IconButton icon="add" accessibilityLabel="Nowy cel" onPress={() => open('nowy')} />} />
      <SectionList
        {...listStyle}
        sections={sections}
        keyExtractor={(goal) => String(goal.id)}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <AppText variant="label" tone="textSecondary" style={styles.sectionHeader}>
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => <GoalCard goal={item} today={today} onPress={() => open(item.id)} />}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          loaded ? (
            <EmptyState
              icon="sports_score"
              title="Brak celów"
              description="Wyznacz cel na dłużej, np. „100 km biegu we wrześniu” albo „12 książek w tym roku”. Postęp policzy się sam."
            />
          ) : null
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { paddingTop: spacing.md, paddingBottom: spacing.sm },
});
