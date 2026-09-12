import { Image } from 'expo-image';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/button';
import type { NoteImage } from '@/db/notes';
import { spacing } from '@/theme/theme';

type Props = { image: NoteImage | null; onClose: () => void; onDelete: (image: NoteImage) => void };

/** Zdjęcie z notatki na cały ekran, z zamykaniem i usuwaniem. */
export function ImageViewer({ image, onClose, onDelete }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={image !== null} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {image ? (
        <View style={[styles.viewer, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={styles.bar}>
            <IconButton icon="close" color="#FFFFFF" accessibilityLabel="Zamknij" onPress={onClose} />
            <View style={styles.flex} />
            <IconButton icon="delete" color="#FFFFFF" accessibilityLabel="Usuń zdjęcie" onPress={() => onDelete(image)} />
          </View>
          <Image source={{ uri: image.uri }} style={styles.flex} contentFit="contain" />
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)' },
  bar: { flexDirection: 'row', paddingHorizontal: spacing.sm },
  flex: { flex: 1 },
});
