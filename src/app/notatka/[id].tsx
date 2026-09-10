import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import {
  createNote,
  deleteNote,
  getNote,
  isNoteEmpty,
  setNotePinned,
  updateNote,
  type NoteContent,
} from '@/db/notes';
import { formatTimestamp } from '@/lib/dates';
import { useAutosave } from '@/lib/use-autosave';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/**
 * Nowa notatka: /notatka/nowa, edycja: /notatka/123.
 * Notatka zapisuje się sama. Nowa trafia do bazy dopiero, gdy coś zawiera,
 * a wyczyszczona do zera jest usuwana przy wyjściu z edytora.
 */
export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowa';

  const db = useSQLiteContext();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bodyInput = useRef<TextInput>(null);

  const [content, setContent] = useState<NoteContent>({ title: '', body: '' });
  const [pinned, setPinned] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);

  // Refy, bo czyta je zapis działający w tle i sprzątanie przy wyjściu.
  const noteId = useRef<number | null>(isNew ? null : Number(id));
  const pinnedRef = useRef(false);
  /** null, dopóki istniejąca notatka się nie wczyta — wtedy nie wolno jej usuwać jako pustej. */
  const latest = useRef<NoteContent | null>(isNew ? { title: '', body: '' } : null);

  const { schedule, flush } = useAutosave<NoteContent>(async (value) => {
    if (isNoteEmpty(value)) return;
    if (noteId.current === null) {
      noteId.current = await createNote(db, value, pinnedRef.current);
    } else {
      await updateNote(db, noteId.current, value);
    }
    setUpdatedAt(new Date().toISOString());
  });

  useEffect(() => {
    if (isNew) return;
    getNote(db, Number(id)).then((note) => {
      if (!note) {
        router.back();
        return;
      }
      const loadedContent = { title: note.title, body: note.body };
      latest.current = loadedContent;
      pinnedRef.current = note.pinned === 1;
      setContent(loadedContent);
      setPinned(note.pinned === 1);
      setUpdatedAt(note.updated_at);
      setLoaded(true);
    });
  }, [db, id, isNew]);

  // Wyjście z edytora: dokończ zapis i usuń notatkę, jeśli została pusta.
  useEffect(
    () => () => {
      void flush().then(() => {
        const savedId = noteId.current;
        if (savedId !== null && latest.current && isNoteEmpty(latest.current)) {
          return deleteNote(db, savedId);
        }
      });
    },
    [db, flush],
  );

  const change = (patch: Partial<NoteContent>) => {
    const next = { ...content, ...patch };
    latest.current = next;
    setContent(next);
    schedule(next);
  };

  const togglePin = () => {
    const next = !pinned;
    pinnedRef.current = next;
    setPinned(next);
    // Po flush(), żeby nie wyprzedzić trwającego INSERT-a nowej notatki.
    void flush().then(() => {
      if (noteId.current !== null) return setNotePinned(db, noteId.current, next);
    });
  };

  const confirmDelete = () => {
    Alert.alert('Usunąć notatkę?', 'Tej operacji nie można cofnąć.', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          await flush();
          if (noteId.current !== null) await deleteNote(db, noteId.current);
          noteId.current = null;
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={styles.headerActions}>
              <IconButton
                icon="push_pin"
                color={pinned ? colors.notes : colors.textMuted}
                accessibilityLabel={pinned ? 'Odepnij' : 'Przypnij'}
                onPress={togglePin}
              />
              <IconButton icon="delete" accessibilityLabel="Usuń notatkę" onPress={confirmDelete} />
            </View>
          ),
        }}
      />

      <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
        {loaded ? (
          <>
            <TextInput
              value={content.title}
              onChangeText={(title) => change({ title })}
              placeholder="Tytuł"
              placeholderTextColor={colors.textMuted}
              cursorColor={colors.accent}
              selectionColor={colors.accentSoft}
              autoFocus={isNew}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => bodyInput.current?.focus()}
              style={[styles.title, { color: colors.text }]}
            />
            <AppText variant="caption" tone="textMuted">
              {updatedAt ? `Zapisano: ${formatTimestamp(updatedAt).toLowerCase()}` : 'Nowa notatka'}
            </AppText>
            <TextInput
              ref={bodyInput}
              value={content.body}
              onChangeText={(body) => change({ body })}
              placeholder="Zacznij pisać…"
              placeholderTextColor={colors.textMuted}
              cursorColor={colors.accent}
              selectionColor={colors.accentSoft}
              multiline
              textAlignVertical="top"
              style={[styles.body, { color: colors.text }]}
            />
          </>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  headerActions: { flexDirection: 'row' },
  title: { fontSize: 24, fontWeight: '700', paddingVertical: spacing.xs },
  body: { flex: 1, fontSize: 16, lineHeight: 24, paddingTop: spacing.md },
});
