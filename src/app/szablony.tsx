import { Stack, router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { TEMPLATES_SQL, type WorkoutTemplate } from '@/db/templates';
import { useQuery } from '@/db/use-query';
import { plural } from '@/lib/format';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Lista szablonów treningów siłowych. */
export default function TemplatesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { rows: templates, loaded } = useQuery<WorkoutTemplate>(TEMPLATES_SQL, [], ['workout_templates', 'template_sets']);

  const open = (id: number | 'nowy') => router.push({ pathname: '/szablon/[id]', params: { id: String(id) } });

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Szablony treningów',
          headerRight: () => <IconButton icon="add" accessibilityLabel="Nowy szablon" onPress={() => open('nowy')} />,
        }}
      />
      <FlatList
        data={templates}
        keyExtractor={(template) => String(template.id)}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item.id)}
            android_ripple={{ color: colors.border }}
            style={[styles.row, { backgroundColor: colors.surface }]}>
            <View style={[styles.icon, { backgroundColor: withAlpha(colors.activity, 0.16) }]}>
              <Icon name="fitness_center" color={colors.activity} />
            </View>
            <View style={styles.body}>
              <AppText variant="bodyStrong">{item.name}</AppText>
              <AppText variant="caption" tone="textSecondary">
                {plural(item.exercise_count, ['ćwiczenie', 'ćwiczenia', 'ćwiczeń'])} ·{' '}
                {plural(item.set_count, ['seria', 'serie', 'serii'])}
              </AppText>
            </View>
            <Icon name="chevron_right" color={colors.textMuted} />
          </Pressable>
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

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, padding: spacing.lg },
  hint: { paddingBottom: spacing.md },
  separator: { height: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  icon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
});
