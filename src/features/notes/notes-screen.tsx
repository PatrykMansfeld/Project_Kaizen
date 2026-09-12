import { router } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { Separator } from '@/components/separator';
import { NOTES_SQL, type Note } from '@/db/notes';
import { parseTagIds } from '@/db/tags';
import { useQuery } from '@/db/use-query';
import { NoteCard } from '@/features/notes/note-card';
import { TagFilter, useTags } from '@/features/tags/tags';
import { matchesSearch, normalizeForSearch } from '@/lib/search';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

export function NotesScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<number | null>(null);
  const { byId: tagsById } = useTags();
  const { rows: notes, loaded } = useQuery<Note>(NOTES_SQL, [], ['notes', 'note_tags', 'tags']);

  const query = normalizeForSearch(search.trim());
  const visible = notes.filter(
    (note) =>
      (!query || matchesSearch(`${note.title}\n${note.body}`, query)) &&
      (tag === null || parseTagIds(note.tag_ids).includes(tag)),
  );
  const pinned = visible.filter((note) => note.pinned);
  const others = visible.filter((note) => !note.pinned);
  // Nagłówki sekcji tylko wtedy, gdy są przypięte notatki.
  const sections = (
    pinned.length
      ? [
          { title: 'Przypięte', data: pinned },
          { title: 'Pozostałe', data: others },
        ]
      : [{ title: '', data: others }]
  ).filter((section) => section.data.length > 0);

  const openNote = (id: number | 'nowa') =>
    router.push({ pathname: '/notatka/[id]', params: { id: String(id) } });

  return (
    <Screen
      title="Notatki"
      headerRight={
        <IconButton icon="add" variant="filled" accessibilityLabel="Nowa notatka" onPress={() => openNote('nowa')} />
      }>
      {notes.length > 0 ? (
        <View style={styles.search}>
          <SearchField value={search} onChangeText={setSearch} placeholder="Szukaj w notatkach" />
        </View>
      ) : null}
      <TagFilter selected={tag} onChange={setTag} />

      <SectionList
        sections={sections}
        keyExtractor={(note) => String(note.id)}
        renderItem={({ item }) => (
          <NoteCard note={item} today={today} tagsById={tagsById} onPress={() => openNote(item.id)} />
        )}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <AppText variant="label" tone="textSecondary" style={styles.sectionHeader}>
              {section.title}
            </AppText>
          ) : null
        }
        ItemSeparatorComponent={Separator}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loaded ? null : query || tag !== null ? (
            <EmptyState
              icon="search"
              color={colors.notes}
              title="Nic nie znaleziono"
              description={
                query
                  ? `Żadna notatka nie zawiera „${search.trim()}”.`
                  : `Brak notatek z tagiem #${tagsById.get(tag!)?.name ?? ''}.`
              }
            />
          ) : (
            <EmptyState
              icon="sticky_note_2"
              color={colors.notes}
              title="Brak notatek"
              description="Dotknij +, żeby zapisać pierwszą myśl."
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  sectionHeader: { paddingTop: spacing.md, paddingBottom: spacing.sm },
});
