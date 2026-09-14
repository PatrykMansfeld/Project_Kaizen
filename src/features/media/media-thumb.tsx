import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { StoredImage } from '@/components/stored-image';
import type { MediaItem } from '@/db/media';
import { radius } from '@/theme/theme';

import { MEDIA_KINDS } from './media';

const SIZES = {
  small: { width: 32, height: 48, emoji: 24 },
  large: { width: 44, height: 66, emoji: 28 },
  huge: { width: 96, height: 144, emoji: 56 },
} as const;

/** Okładka tytułu, a bez niej (albo gdy pliku już nie ma, np. po przywróceniu kopii) — emoji rodzaju. */
export function MediaThumb({ item, size }: { item: Pick<MediaItem, 'kind' | 'cover_uri'>; size: keyof typeof SIZES }) {
  const { width, height, emoji } = SIZES[size];
  return (
    <StoredImage
      uri={item.cover_uri}
      style={[styles.cover, { width, height }]}
      fallback={<AppText style={[styles.emoji, { fontSize: emoji, lineHeight: emoji * 1.25, width }]}>{MEDIA_KINDS[item.kind].emoji}</AppText>}
    />
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: radius.sm / 2 },
  emoji: { textAlign: 'center' },
});
