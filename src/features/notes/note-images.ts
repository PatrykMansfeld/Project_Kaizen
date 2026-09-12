import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

/**
 * Zdjęcia w notatkach kopiujemy do katalogu aplikacji — dzięki temu nie znikną po usunięciu
 * z galerii. W bazie zapisujemy tylko ścieżkę. Pliki nie trafiają do kopii zapasowej JSON.
 */

function imagesDirectory() {
  const directory = new Directory(Paths.document, 'note-images');
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export type PickResult = { uris: string[] } | { denied: true } | null;

/** Wybór zdjęć z galerii i skopiowanie ich do aplikacji. Null = anulowano. */
export async function pickNoteImages(): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { denied: true };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 0.8,
  });
  if (result.canceled || !result.assets) return null;

  const directory = imagesDirectory();
  const uris: string[] = [];
  for (const asset of result.assets) {
    const extension = asset.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
    const target = new File(directory, `${Crypto.randomUUID()}.${extension}`);
    await new File(asset.uri).copy(target);
    uris.push(target.uri);
  }
  return { uris };
}

/** Usuwa pliki zdjęć (np. po skasowaniu notatki); brakujące pliki pomija. */
export function deleteImageFiles(uris: string[]) {
  for (const uri of uris) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch (error) {
      console.warn('Nie udało się usunąć zdjęcia:', error);
    }
  }
}
