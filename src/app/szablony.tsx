import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { IconBadge } from '@/components/icon-badge';
import { StackHeader, useListScreenStyle } from '@/components/screen';
import { Separator } from '@/components/separator';
import { TEMPLATES_SQL, type WorkoutTemplate } from '@/db/templates';
import { useQuery } from '@/db/use-query';
import { plural } from '@/lib/format';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Lista szablonów treningów siłowych. */
export default function TemplatesScreen() {
  const { colors } = useTheme();
  const listStyle = useListScreenStyle();
  const { rows: templates, loaded } = useQuery<WorkoutTemplate>(TEMPLATES_SQL, [], ['workout_templates', 'template_sets']);

  const open = (id: number | 'nowy') => router.push({ pathname: '/szablon/[id]', params: { id: String(id) } });

  return (
    <>
      <StackHeader
        title="Szablony treningów"
        headerRight={<IconButton icon="add" accessibilityLabel="Nowy szablon" onPress={() => open('nowy')} />}
      />
      <FlatList
        {...listStyle}
        data={templates}
        keyExtractor={(template) => String(template.id)}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <Card variant="row" onPress={() => open(item.id)}>
            <IconBadge icon="fitness_center" color={colors.activity} />
            <View style={styles.body}>
              <AppText variant="bodyStrong">{item.name}</AppText>
              <AppText variant="caption" tone="textSecondary">
                {plural(item.exercise_count, ['ćwiczenie', 'ćwiczenia', 'ćwiczeń'])} ·{' '}
                {plural(item.set_count, ['seria', 'serie', 'serii'])}
              </AppText>
            </View>
            <Icon name="chevron_right" color={colors.textMuted} />
          </Card>
        )}
        ListHeaderComponent={
          templates.length ? (
            <AppText variant="caption" tone="textSecondary" style={styles.hint}>
              Przy nowym treningu siłowym wybierz szablon, żeby od razu mieć listę ćwiczeń i serii.
            </AppText>
          ) : null
        }
        ListEmptyComponent={
          loaded ? (
            <EmptyState
              icon="fitness_center"
              color={colors.activity}
              title="Brak szablonów"
              description="Utwórz szablon przyciskiem + albo zapisz gotowy trening jako szablon."
            />
          ) : null
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  hint: { paddingBottom: spacing.md },
  body: { flex: 1, gap: 2 },
});
