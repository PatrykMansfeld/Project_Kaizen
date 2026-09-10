import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { DayNavigator } from '@/components/day-navigator';
import { getJournalEntry, saveJournalEntry, type JournalContent } from '@/db/journal';
import { MOODS } from '@/features/journal/moods';
import { formatTimestamp, isDateKey, type DateKey } from '@/lib/dates';
import { useAutosave } from '@/lib/use-autosave';
import { useToday } from '@/lib/use-today';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Dziennik: /dziennik/2026-09-10. Strzałki przełączają dni, wpis zapisuje się sam. */
export default function JournalScreen() {
  const params = useLocalSearchParams<{ date: string }>();
  const today = useToday();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState<DateKey>(isDateKey(params.date) ? params.date : today);

  return (
    <>
      <Stack.Screen options={{ title: 'Dziennik' }} />
      <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
        <DayNavigator date={date} today={today} onChange={setDate} maxDate={today} />
        {/* key: zmiana dnia montuje edytor od nowa, a odmontowanie zapisuje poprzedni dzień. */}
        <JournalEditor key={date} date={date} />
      </View>
    </>
  );
}

function JournalEditor({ date }: { date: DateKey }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [entry, setEntry] = useState<JournalContent>({ mood: null, body: '' });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  if (!loaded) return null;

  return (
    <View style={styles.editor}>
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

      <TextInput
        value={entry.body}
        onChangeText={(body) => change({ body })}
        placeholder="Jak minął dzień? Co poszło dobrze, co chcesz zapamiętać?"
        placeholderTextColor={colors.textMuted}
        cursorColor={colors.accent}
        selectionColor={colors.accentSoft}
        multiline
        textAlignVertical="top"
        style={[styles.body, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
      />
      <AppText variant="caption" tone="textMuted">
        {updatedAt ? `Zapisano: ${formatTimestamp(updatedAt).toLowerCase()}` : 'Wpis zapisze się automatycznie'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  editor: { flex: 1, gap: spacing.md, paddingBottom: spacing.md },
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
  body: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
