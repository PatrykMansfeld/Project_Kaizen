import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import type { Note } from '@/db/notes';
import { parseTagIds, type Tag } from '@/db/tags';
import { TagBadges } from '@/features/tags/tags';
import { formatTimestamp, type DateKey } from '@/lib/dates';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { checklistProgress, notePreview } from './markdown';

type Props = { note: Note; today: DateKey; onPress: () => void; tagsById?: Map<number, Tag> };

export function NoteCard({ note, today, onPress, tagsById }: Props) {
  const { colors } = useTheme();
  const { headline, preview } = notePreview(note);
  const checklist = checklistProgress(note.body);

  return (
    <Card onPress={onPress} style={styles.card}>
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
      {tagsById ? <TagBadges tagIds={parseTagIds(note.tag_ids)} byId={tagsById} /> : null}
      <AppText variant="caption" tone="textMuted">
        {[
          formatTimestamp(note.updated_at, today),
          checklist.total ? `☑ ${checklist.done}/${checklist.total}` : null,
          note.image_count ? `🖼 ${note.image_count}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, paddingVertical: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headline: { flex: 1 },
});
