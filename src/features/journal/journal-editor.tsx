import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
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
      <View style={styles.section}>
        <AppText variant="label" tone="textSecondary">
          Nastrój
        </AppText>
        <View style={styles.moods}>
          {MOODS.map((mood) => {
            const selected = entry.mood === mood.value;
            return (
              <Pressable
                key={mood.value}
                // Ponowne stuknięcie odznacza nastrój.
                onPress={() => change({ mood: selected ? null : mood.value }, true)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={mood.label}
                style={[
                  styles.mood,
                  selected
                    ? { backgroundColor: withAlpha(colors.journal, 0.18), borderColor: colors.journal }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}>
                <Text style={[styles.moodEmoji, { opacity: entry.mood === null || selected ? 1 : 0.45 }]}>
                  {mood.emoji}
                </Text>
                <AppText variant="caption" tone={selected ? 'text' : 'textSecondary'} numberOfLines={1}>
                  {mood.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

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
  section: { gap: spacing.sm },
  moods: { flexDirection: 'row', gap: spacing.sm },
  mood: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  moodEmoji: { fontSize: 28 },
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
