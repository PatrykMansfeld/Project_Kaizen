import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmojiScale } from '@/components/emoji-scale';
import { Icon } from '@/components/icon';
import { Section } from '@/components/section';
import { getJournalEntry, saveJournalEntry, type JournalContent } from '@/db/journal';
import { formatTimestamp, type DateKey } from '@/lib/dates';
import { useAutosave } from '@/lib/use-autosave';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { MOODS } from './moods';
import { promptForDate } from './prompts';

type Props = {
  date: DateKey;
  /** compact — tekst o stałej wysokości (np. w podsumowaniu dnia), inaczej wypełnia ekran. */
  compact?: boolean;
};

/**
 * Nastrój 1–5, pytanie na dziś i tekst wpisu. Zapisuje się sam; zmiana dnia wymaga nowego
 * montowania (key={date}), a odmontowanie zapisuje ostatnie zmiany.
 */
export function JournalEditor({ date, compact = false }: Props) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [entry, setEntry] = useState<JournalContent>({ mood: null, body: '' });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [promptOffset, setPromptOffset] = useState(0);
  const prompt = promptForDate(date, promptOffset);

  const { schedule, flush } = useAutosave<JournalContent>(async (value) => {
    await saveJournalEntry(db, date, value);
    setUpdatedAt(new Date().toISOString());
  });

  useEffect(() => {
    getJournalEntry(db, date).then((row) => {
      if (row) {
        setEntry({ mood: row.mood, body: row.body });
        setUpdatedAt(row.updated_at);
      }
      setLoaded(true);
    });
  }, [db, date]);

  const change = (patch: Partial<JournalContent>, immediate = false) => {
    const next = { ...entry, ...patch };
    setEntry(next);
    schedule(next);
    if (immediate) void flush();
  };

  // Pytanie trafia do tekstu jako nowa linia, pod którą można od razu pisać odpowiedź.
  const insertPrompt = () => {
    const body = entry.body.trimEnd();
    change({ body: `${body ? `${body}\n\n` : ''}${prompt}\n` });
  };

  if (!loaded) return null;

  return (
    <View style={[styles.editor, !compact && styles.fill]}>
      <Section title="Nastrój">
        {/* Ponowne stuknięcie odznacza nastrój; zmiana zapisuje się od razu. */}
        <EmojiScale
          options={MOODS}
          value={entry.mood}
          onChange={(mood) => change({ mood }, true)}
          color={colors.journal}
          dimUnselected
        />
      </Section>

      <View style={[styles.prompt, { backgroundColor: withAlpha(colors.journal, 0.08) }]}>
        <Icon name="lightbulb" size={18} color={colors.journal} />
        <AppText style={styles.flex}>{prompt}</AppText>
        <Pressable onPress={() => setPromptOffset(promptOffset + 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Inne pytanie">
          <Icon name="shuffle" size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={insertPrompt} hitSlop={8} accessibilityRole="button" accessibilityLabel="Wstaw pytanie do wpisu">
          <Icon name="playlist_add" size={22} color={colors.accent} />
        </Pressable>
      </View>

      <TextInput
        value={entry.body}
        onChangeText={(body) => change({ body })}
        placeholder="Jak minął dzień? Co poszło dobrze, co chcesz zapamiętać?"
        placeholderTextColor={colors.textMuted}
        cursorColor={colors.accent}
        selectionColor={colors.accentSoft}
        multiline
        textAlignVertical="top"
        style={[
          styles.body,
          compact ? styles.bodyCompact : styles.fill,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      />
      <AppText variant="caption" tone="textMuted">
        {updatedAt ? `Zapisano: ${formatTimestamp(updatedAt).toLowerCase()}` : 'Wpis zapisze się automatycznie'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: spacing.md, paddingBottom: spacing.md },
  fill: { flex: 1 },
  flex: { flex: 1 },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bodyCompact: { minHeight: 140 },
});
