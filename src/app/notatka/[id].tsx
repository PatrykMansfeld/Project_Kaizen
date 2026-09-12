import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { HeaderActions } from '@/components/header';
import { Icon, type IconName } from '@/components/icon';
import { StackHeader } from '@/components/screen';
import {
  NOTE_IMAGES_SQL,
  addNoteImage,
  createNote,
  deleteNote,
  deleteNoteImage,
  getNote,
  getNoteImageUris,
  isNoteEmpty,
  setNotePinned,
  updateNote,
  type NoteContent,
  type NoteImage,
} from '@/db/notes';
import { getNoteTagIds, setNoteTags } from '@/db/tags';
import { useQuery } from '@/db/use-query';
import { applyFormat, toggleCheckLine, type Format, type Selection } from '@/features/notes/markdown';
import { ImageViewer } from '@/features/notes/image-viewer';
import { MarkdownView } from '@/features/notes/markdown-view';
import { deleteImageFiles, pickNoteImages } from '@/features/notes/note-images';
import { TagBadges, TagPicker, useTags } from '@/features/tags/tags';
import { alertPermissionBlocked, confirmDelete } from '@/lib/alerts';
import { formatTimestamp } from '@/lib/dates';
import { useAutosave } from '@/lib/use-autosave';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const TOOLBAR: { format: Format; icon: IconName; label: string }[] = [
  { format: 'heading', icon: 'title', label: 'Nagłówek' },
  { format: 'bold', icon: 'format_bold', label: 'Pogrubienie' },
  { format: 'bullet', icon: 'format_list_bulleted', label: 'Lista' },
  { format: 'check', icon: 'checklist', label: 'Checklista' },
];

/**
 * Nowa notatka: /notatka/nowa, edycja: /notatka/123.
 * Notatka zapisuje się sama. Nowa trafia do bazy dopiero, gdy coś zawiera (tekst albo zdjęcie),
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
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [preview, setPreview] = useState(false);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  /** Pozycja kursora ustawiana po użyciu paska narzędzi (jednorazowo). */
  const [forcedSelection, setForcedSelection] = useState<Selection | undefined>(undefined);
  const [savedId, setSavedId] = useState<number | null>(isNew ? null : Number(id));
  const [viewing, setViewing] = useState<NoteImage | null>(null);
  const { byId: tagsById } = useTags();
  const { rows: images } = useQuery<NoteImage>(NOTE_IMAGES_SQL, { $note: savedId ?? -1 }, ['note_images']);

  // Refy, bo czyta je zapis działający w tle i sprzątanie przy wyjściu.
  const noteId = useRef<number | null>(isNew ? null : Number(id));
  const pinnedRef = useRef(false);
  const tagsRef = useRef<number[]>([]);
  const imageCount = useRef(0);
  /** null, dopóki istniejąca notatka się nie wczyta — wtedy nie wolno jej usuwać jako pustej. */
  const latest = useRef<NoteContent | null>(isNew ? { title: '', body: '' } : null);

  useEffect(() => {
    imageCount.current = images.length;
  }, [images.length]);

  /** Tworzy notatkę w bazie (także pustą — np. przed dodaniem zdjęcia) i zapamiętuje jej id. */
  const insertNote = async (value: NoteContent) => {
    const created = await createNote(db, value, pinnedRef.current);
    noteId.current = created;
    setSavedId(created);
    // Tagi wybrane, zanim notatka trafiła do bazy.
    if (tagsRef.current.length) await setNoteTags(db, created, tagsRef.current);
    return created;
  };

  const { schedule, flush } = useAutosave<NoteContent>(async (value) => {
    if (noteId.current === null) {
      if (isNoteEmpty(value)) return;
      await insertNote(value);
    } else {
      await updateNote(db, noteId.current, value);
    }
    setUpdatedAt(new Date().toISOString());
  });

  useEffect(() => {
    if (isNew) return;
    Promise.all([getNote(db, Number(id)), getNoteTagIds(db, Number(id))]).then(([note, noteTagIds]) => {
      if (!note) {
        router.back();
        return;
      }
      const loadedContent = { title: note.title, body: note.body };
      latest.current = loadedContent;
      pinnedRef.current = note.pinned === 1;
      tagsRef.current = noteTagIds;
      setContent(loadedContent);
      setPinned(note.pinned === 1);
      setTagIds(noteTagIds);
      setUpdatedAt(note.updated_at);
      // Istniejąca notatka z treścią otwiera się w podglądzie (formatowanie, klikalne checklisty).
      setPreview(note.body.trim().length > 0);
      setLoaded(true);
    });
  }, [db, id, isNew]);

  // Wyjście z edytora: dokończ zapis i usuń notatkę, jeśli została pusta (bez tekstu i zdjęć).
  useEffect(
    () => () => {
      void flush().then(() => {
        const current = noteId.current;
        if (current !== null && latest.current && isNoteEmpty(latest.current) && imageCount.current === 0) {
          return deleteNote(db, current);
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

  const format = (kind: Format) => {
    const result = applyFormat(content.body, selection, kind);
    change({ body: result.body });
    setForcedSelection(result.selection);
    setSelection(result.selection);
    bodyInput.current?.focus();
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

  const changeTags = (next: number[]) => {
    tagsRef.current = next;
    setTagIds(next);
    void flush().then(() => {
      if (noteId.current !== null) return setNoteTags(db, noteId.current, next);
    });
  };

  const addImages = async () => {
    const result = await pickNoteImages();
    if (!result) return;
    if ('denied' in result) {
      alertPermissionBlocked('Brak dostępu do zdjęć', 'Zezwól Kaizen na dostęp do zdjęć w ustawieniach telefonu.');
      return;
    }
    await flush();
    const target = noteId.current ?? (await insertNote(latest.current ?? content));
    for (const uri of result.uris) await addNoteImage(db, target, uri);
    imageCount.current += result.uris.length;
  };

  const removeImage = (image: NoteImage) =>
    confirmDelete('Usunąć zdjęcie?', undefined, async () => {
      await deleteNoteImage(db, image.id);
      deleteImageFiles([image.uri]);
      setViewing(null);
    });

  const remove = () =>
    confirmDelete('Usunąć notatkę?', 'Tej operacji nie można cofnąć.', async () => {
      await flush();
      const current = noteId.current;
      if (current !== null) {
        const uris = await getNoteImageUris(db, current);
        await deleteNote(db, current);
        deleteImageFiles(uris);
      }
      noteId.current = null;
      router.back();
    });

  return (
    <>
      <StackHeader
        title=""
        headerRight={
          <HeaderActions>
            <IconButton
              icon={preview ? 'edit' : 'visibility'}
              accessibilityLabel={preview ? 'Edytuj' : 'Podgląd'}
              onPress={() => setPreview(!preview)}
            />
            <IconButton
              icon="push_pin"
              color={pinned ? colors.notes : colors.textMuted}
              accessibilityLabel={pinned ? 'Odepnij' : 'Przypnij'}
              onPress={togglePin}
            />
            <IconButton icon="delete" accessibilityLabel="Usuń notatkę" onPress={remove} />
          </HeaderActions>
        }
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
              onSubmitEditing={() => {
                setPreview(false);
                bodyInput.current?.focus();
              }}
              style={[styles.title, { color: colors.text }]}
            />
            <View style={styles.metaRow}>
              <AppText variant="caption" tone="textMuted" style={styles.flex}>
                {updatedAt ? `Zapisano: ${formatTimestamp(updatedAt).toLowerCase()}` : 'Nowa notatka'}
              </AppText>
              <Pressable onPress={() => setTagsOpen(!tagsOpen)} hitSlop={8} accessibilityRole="button" style={styles.tagsToggle}>
                <Icon name="sell" size={16} color={tagsOpen ? colors.accent : colors.textSecondary} />
                <AppText variant="caption" tone={tagsOpen ? 'accent' : 'textSecondary'}>
                  {tagsOpen ? 'Gotowe' : 'Tagi'}
                </AppText>
              </Pressable>
            </View>
            {tagsOpen ? <TagPicker selected={tagIds} onChange={changeTags} /> : <TagBadges tagIds={tagIds} byId={tagsById} />}

            {images.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll} contentContainerStyle={styles.images}>
                {images.map((image) => (
                  <Pressable key={image.id} onPress={() => setViewing(image)} accessibilityLabel="Pokaż zdjęcie">
                    <Image source={{ uri: image.uri }} style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {preview ? (
              <ScrollView style={styles.flex}>
                <MarkdownView
                  body={content.body}
                  onToggleCheck={(line) => change({ body: toggleCheckLine(content.body, line) })}
                  onPressText={() => setPreview(false)}
                />
              </ScrollView>
            ) : (
              <>
                <View style={[styles.toolbar, { borderColor: colors.border }]}>
                  {TOOLBAR.map((tool) => (
                    <IconButton key={tool.format} icon={tool.icon} accessibilityLabel={tool.label} onPress={() => format(tool.format)} />
                  ))}
                  <View style={styles.flex} />
                  <IconButton icon="add_photo_alternate" accessibilityLabel="Dodaj zdjęcie" onPress={addImages} />
                </View>
                <TextInput
                  ref={bodyInput}
                  value={content.body}
                  onChangeText={(body) => change({ body })}
                  onSelectionChange={(event) => {
                    setSelection(event.nativeEvent.selection);
                    if (forcedSelection) setForcedSelection(undefined);
                  }}
                  selection={forcedSelection}
                  placeholder="Zacznij pisać…  (# nagłówek, - lista, - [ ] zadanie, **pogrubienie**)"
                  placeholderTextColor={colors.textMuted}
                  cursorColor={colors.accent}
                  selectionColor={colors.accentSoft}
                  multiline
                  textAlignVertical="top"
                  style={[styles.body, { color: colors.text }]}
                />
              </>
            )}
          </>
        ) : null}
      </View>

      <ImageViewer image={viewing} onClose={() => setViewing(null)} onDelete={removeImage} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  title: { fontSize: 24, fontWeight: '700', paddingVertical: spacing.xs },
  body: { flex: 1, fontSize: 16, lineHeight: 24, paddingTop: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  tagsToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  toolbar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  imagesScroll: { flexGrow: 0 },
  images: { gap: spacing.sm, paddingVertical: spacing.xs },
  thumb: { width: 88, height: 88, borderRadius: radius.md },
});
