import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { alertPermissionBlocked } from '@/lib/alerts';
import { deleteImageFiles, pickImages, type ImageFolder } from '@/lib/images';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/**
 * Jedno zdjęcie w formularzu (okładka, zdjęcie ze spełnionego marzenia). Wybrane pliki trafiają do katalogu
 * aplikacji od razu, więc szkic pilnuje sprzątania: po zapisie usuwa zastąpione, a po wyjściu bez zapisu —
 * wybrane w tej wizycie.
 */
export function usePhotoDraft(folder: ImageFolder) {
  const [uri, setUri] = useState<string | null>(null);
  const original = useRef<string | null>(null);
  const picked = useRef<string[]>([]);
  const committed = useRef(false);

  useEffect(
    () => () => {
      if (!committed.current) deleteImageFiles(picked.current);
    },
    [],
  );

  return {
    uri,
    /** Zdjęcie zapisane w bazie (po wczytaniu rekordu). */
    load: (initial: string | null) => {
      original.current = initial;
      setUri(initial);
    },
    pick: async () => {
      const result = await pickImages(folder, 1);
      if (!result) return;
      if ('denied' in result) {
        alertPermissionBlocked('Brak dostępu do zdjęć', 'Zezwól Kaizen na dostęp do zdjęć w ustawieniach telefonu.');
        return;
      }
      picked.current.push(...result.uris);
      setUri(result.uris[0] ?? null);
    },
    remove: () => setUri(null),
    /** Po zapisie z `saved` w bazie: usuwa pliki, których nic już nie używa. */
    commit: (saved: string | null) => {
      committed.current = true;
      deleteImageFiles([original.current, ...picked.current].filter((file): file is string => file !== null && file !== saved));
    },
    /** Rekord usunięty: znikają wszystkie pliki z tego formularza. */
    discardAll: () => {
      committed.current = true;
      deleteImageFiles([original.current, ...picked.current].filter((file): file is string => file !== null));
    },
  };
}

type Props = {
  uri: string | null;
  onPick: () => void;
  onRemove: () => void;
  /** Proporcje podglądu: okładka (2:3) albo zdjęcie (4:3). */
  shape?: 'cover' | 'photo';
  emptyLabel: string;
};

/** Podgląd zdjęcia z przyciskami „Zmień” i „Usuń”, a bez zdjęcia — pole „Dodaj”. */
export function PhotoField({ uri, onPick, onRemove, shape = 'photo', emptyLabel }: Props) {
  const { colors } = useTheme();
  const frame = shape === 'cover' ? styles.cover : styles.photo;

  if (!uri) {
    return (
      <Pressable
        onPress={onPick}
        accessibilityRole="button"
        accessibilityLabel={emptyLabel}
        style={[styles.empty, shape === 'cover' && styles.emptyCover, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Icon name="add_photo_alternate" color={colors.textSecondary} />
        <AppText tone="textSecondary">{emptyLabel}</AppText>
      </Pressable>
    );
  }

  return (
    <View style={[styles.filled, shape === 'cover' && styles.filledCover]}>
      <Image source={{ uri }} style={[frame, { backgroundColor: colors.surfaceAlt }]} contentFit="cover" />
      <View style={[styles.actions, shape === 'cover' && styles.flex]}>
        <Button label="Zmień" icon="photo_library" variant="secondary" onPress={onPick} />
        <Button label="Usuń" icon="delete" variant="danger" onPress={onRemove} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyCover: { minHeight: 64 },
  filled: { gap: spacing.sm },
  filledCover: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cover: { width: 96, aspectRatio: 2 / 3, borderRadius: radius.sm },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md },
  actions: { gap: spacing.sm },
  flex: { flex: 1 },
});
