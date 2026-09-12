import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Chip } from '@/components/chip';
import { TAGS_SQL, createTag, deleteTag, type Tag } from '@/db/tags';
import { useQuery } from '@/db/use-query';
import { confirmDelete } from '@/lib/alerts';
import { paletteColor } from '@/theme/palette';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Wszystkie tagi i mapa id → tag (odświeża się sama po zmianach). */
export function useTags() {
  const { rows: tags } = useQuery<Tag>(TAGS_SQL, [], ['tags']);
  return { tags, byId: new Map(tags.map((tag) => [tag.id, tag])) };
}

/** Małe kolorowe odznaki tagów, np. w wierszu zadania lub karcie notatki. */
export function TagBadges({ tagIds, byId }: { tagIds: number[]; byId: Map<number, Tag> }) {
  const { dark } = useTheme();
  const tags = tagIds.map((id) => byId.get(id)).filter((tag): tag is Tag => !!tag);
  if (tags.length === 0) return null;

  return (
    <View style={styles.badges}>
      {tags.map((tag) => {
        const color = paletteColor(tag.color, dark);
        return (
          <View key={tag.id} style={[styles.badge, { backgroundColor: withAlpha(color, 0.14) }]}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
              {tag.name}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

/** Wybór tagów w formularzu; nowy tag można dopisać od razu. */
export function TagPicker({ selected, onChange }: { selected: number[]; onChange: (tagIds: number[]) => void }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { tags } = useTags();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((tagId) => tagId !== id) : [...selected, id]);

  const add = async () => {
    const trimmed = name.trim().replace(/^#/, '');
    setName('');
    setAdding(false);
    if (!trimmed) return;
    const tag = await createTag(db, trimmed);
    if (!selected.includes(tag.id)) onChange([...selected, tag.id]);
  };

  return (
    <View style={styles.picker}>
      {tags.map((tag) => (
        <Chip key={tag.id} label={`#${tag.name}`} selected={selected.includes(tag.id)} onPress={() => toggle(tag.id)} />
      ))}
      {adding ? (
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="nazwa tagu"
          placeholderTextColor={colors.textMuted}
          cursorColor={colors.accent}
          autoFocus
          autoCapitalize="none"
          returnKeyType="done"
          // Enter zamyka pole (blur), więc dodanie idzie jedną ścieżką — również po stuknięciu obok.
          onBlur={add}
          style={[styles.newTag, { borderColor: colors.accent, color: colors.text }]}
        />
      ) : (
        <Chip label="Nowy tag" icon="add" selected={false} onPress={() => setAdding(true)} />
      )}
    </View>
  );
}

/** Lista tagów w Ustawieniach z możliwością usunięcia. */
export function TagManager() {
  const db = useSQLiteContext();
  const { dark, colors } = useTheme();
  const { tags } = useTags();

  const remove = (tag: Tag) =>
    confirmDelete(`Usunąć tag #${tag.name}?`, 'Tag zniknie ze wszystkich zadań i notatek. Same zadania i notatki zostaną.', () =>
      deleteTag(db, tag.id),
    );

  if (tags.length === 0) {
    return (
      <AppText tone="textSecondary">Nie masz jeszcze tagów. Dodasz je w edycji zadania albo notatki.</AppText>
    );
  }

  return (
    <View>
      {tags.map((tag) => (
        <View key={tag.id} style={styles.managerRow}>
          <View style={[styles.dot, { backgroundColor: paletteColor(tag.color, dark) }]} />
          <AppText style={styles.managerName} numberOfLines={1}>
            #{tag.name}
          </AppText>
          <IconButton
            icon="delete"
            color={colors.textMuted}
            accessibilityLabel={`Usuń tag ${tag.name}`}
            onPress={() => remove(tag)}
          />
        </View>
      ))}
    </View>
  );
}

/** Pozioma lista tagów do filtrowania listy; nic nie renderuje, gdy tagów brak. */
export function TagFilter({ selected, onChange }: { selected: number | null; onChange: (tagId: number | null) => void }) {
  const { tags } = useTags();
  if (tags.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filter}>
      <Chip label="Wszystkie tagi" selected={selected === null} onPress={() => onChange(null)} />
      {tags.map((tag) => (
        <Chip
          key={tag.id}
          label={`#${tag.name}`}
          selected={selected === tag.id}
          onPress={() => onChange(selected === tag.id ? null : tag.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: radius.full },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  newTag: {
    minWidth: 120,
    height: 36,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.full,
    fontSize: 14,
  },
  managerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  managerName: { flex: 1 },
  filterScroll: { flexGrow: 0, marginBottom: spacing.md },
  filter: { gap: spacing.sm, paddingHorizontal: spacing.lg },
});
