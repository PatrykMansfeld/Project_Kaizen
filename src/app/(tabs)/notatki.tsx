import { router } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { NOTES_SQL, type Note } from '@/db/notes';
import { useQuery } from '@/db/use-query';
import { NoteCard } from '@/features/notes/note-card';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

// Szukamy w JS, a nie przez LIKE — SQLite ignoruje wielkość liter tylko w ASCII („Ł” ≠ „ł”).
function matches(note: Note, query: string) {
  return `${note.title}\n${note.body}`.toLowerCase().includes(query);
}

export default function NotesScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const { rows: notes, loaded } = useQuery<Note>(NOTES_SQL, [], ['notes']);

  const query = search.trim().toLowerCase();
  const visible = query ? notes.filter((note) => matches(note, query)) : notes;
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

      <SectionList
        sections={sections}
        keyExtractor={(note) => String(note.id)}
        renderItem={({ item }) => <NoteCard note={item} today={today} onPress={() => openNote(item.id)} />}
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
          !loaded ? null : query ? (
            <EmptyState
              icon="search"
              color={colors.notes}
              title="Nic nie znaleziono"
              description={`Żadna notatka nie zawiera „${search.trim()}”.`}
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

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  sectionHeader: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  separator: { height: spacing.sm },
});
