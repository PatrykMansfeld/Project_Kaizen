import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyLine } from '@/components/empty-state';
import { ImageViewer } from '@/components/image-viewer';
import { Section } from '@/components/section';
import { TRIP_PHOTOS_SQL, addTripPhoto, deleteTripPhoto, type Trip, type TripPhoto } from '@/db/trips';
import { useQuery } from '@/db/use-query';
import { alertPermissionBlocked, confirmDelete } from '@/lib/alerts';
import { deleteImageFiles, pickImages } from '@/lib/images';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

export function PhotosTab({ trip }: { trip: Trip }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { rows: photos } = useQuery<TripPhoto>(TRIP_PHOTOS_SQL, { $trip: trip.id }, ['trip_photos']);
  const [viewing, setViewing] = useState<TripPhoto | null>(null);

  const addPhotos = async () => {
    const result = await pickImages('trip-photos', 30);
    if (!result) return;
    if ('denied' in result) {
      alertPermissionBlocked('Brak dostępu do zdjęć', 'Zezwól Kaizen na dostęp do zdjęć w ustawieniach telefonu.');
      return;
    }
    for (const uri of result.uris) await addTripPhoto(db, trip.id, uri);
  };

  const removePhoto = (photo: TripPhoto) =>
    confirmDelete('Usunąć zdjęcie?', 'Zniknie tylko z aplikacji — w galerii telefonu zostaje.', async () => {
      await deleteTripPhoto(db, photo.id);
      deleteImageFiles([photo.uri]);
      setViewing(null);
    });

  const editTrip = () => router.push({ pathname: '/podroz/edycja/[id]', params: { id: String(trip.id) } });

  return (
    <>
      {photos.length > 0 ? (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <Pressable key={photo.id} onPress={() => setViewing(photo)} style={styles.photoCell} accessibilityLabel="Pokaż zdjęcie">
              <Image source={{ uri: photo.uri }} style={[styles.photo, { backgroundColor: colors.surfaceAlt }]} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyLine text="Dodaj zdjęcia z wyjazdu — pierwsze będzie okładką podróży na liście." />
      )}
      <Button label="Dodaj zdjęcia" icon="add_photo_alternate" variant="secondary" onPress={addPhotos} />

      <Section title="Notatki i wspomnienia">
        <Card onPress={editTrip}>
          <AppText tone={trip.note ? 'text' : 'textMuted'}>{trip.note || 'Co zapamiętać z tego wyjazdu? Stuknij, żeby dopisać.'}</AppText>
        </Card>
      </Section>

      <ImageViewer image={viewing} onClose={() => setViewing(null)} onDelete={removePhoto} />
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  photoCell: { width: '32%', aspectRatio: 1 },
  photo: { flex: 1, borderRadius: radius.sm },
});
