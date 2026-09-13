import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Chip, ChipRow } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ScrollScreen } from '@/components/screen';
import { HABITS_SQL, setHabitAttribute, type Habit } from '@/db/habits';
import { useQuery } from '@/db/use-query';
import { HabitIcon } from '@/features/habits/habit-card';
import { ATTRIBUTES, ATTRIBUTE_KEYS } from '@/features/progress/xp';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Który nawyk rozwija którą cechę (Postęp) — zmiana zapisuje się od razu i przelicza punkty wstecz. */
export default function HabitAttributesScreen() {
  const db = useSQLiteContext();
  const { dark } = useTheme();
  const { rows: habits, loaded } = useQuery<Habit>(HABITS_SQL, [], ['habits']);

  return (
    <ScrollScreen title="Cechy nawyków">
      <AppText tone="textSecondary">
        Każde odhaczenie nawyku daje 10 XP wybranej cesze. Zmiana przelicza też punkty z przeszłości.
      </AppText>
      {loaded && habits.length === 0 ? (
        <EmptyState icon="check_circle" title="Nie masz jeszcze nawyków" description="Dodaj nawyk, a tutaj wybierzesz, którą cechę rozwija." />
      ) : null}
      {habits.map((habit) => (
        <Card key={habit.id} style={styles.card}>
          <View style={styles.header}>
            <HabitIcon icon={habit.icon} color={paletteColor(habit.color, dark)} size={36} />
            <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
              {habit.name}
            </AppText>
          </View>
          <ChipRow>
            {ATTRIBUTE_KEYS.map((key) => (
              <Chip
                key={key}
                label={ATTRIBUTES[key].label}
                selected={habit.attribute === key}
                onPress={() => void setHabitAttribute(db, habit.id, key)}
              />
            ))}
          </ChipRow>
        </Card>
      ))}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
