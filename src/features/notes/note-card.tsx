import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import type { Note } from '@/db/notes';
import { formatTimestamp, type DateKey } from '@/lib/dates';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Nagłówek i podgląd karty. Bez tytułu nagłówkiem jest pierwsza linia treści. */
export function notePreview(note: Pick<Note, 'title' | 'body'>) {
  const lines = note.body.split('\n').map((line) => line.trim()).filter(Boolean);
  const title = note.title.trim();
  if (title) return { headline: title, preview: lines.join(' ') };
  return { headline: lines[0] ?? 'Bez tytułu', preview: lines.slice(1).join(' ') };
}

type Props = { note: Note; today: DateKey; onPress: () => void };

export function NoteCard({ note, today, onPress }: Props) {
  const { colors } = useTheme();
  const { headline, preview } = notePreview(note);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.titleRow}>
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.headline}>
          {headline}
        </AppText>
        {note.pinned ? <Icon name="push_pin" size={16} color={colors.notes} /> : null}
      </View>
      {preview ? (
        <AppText tone="textSecondary" numberOfLines={2}>
          {preview}
        </AppText>
      ) : null}
      <AppText variant="caption" tone="textMuted">
        {formatTimestamp(note.updated_at, today)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headline: { flex: 1 },
});
