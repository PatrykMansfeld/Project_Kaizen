import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { BackupError, createBackup, parseBackup } from '@/db/backup';
import { setSetting } from '@/db/settings';
import { todayKey } from '@/lib/dates';

/** Zapisuje kopię do pliku i otwiera systemowe „Udostępnij” (Dysk Google, Gmail…). */
export async function exportBackup(db: SQLiteDatabase) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new BackupError('Udostępnianie plików nie jest dostępne na tym urządzeniu.');
  }
  const backup = await createBackup(db);
  const file = new File(Paths.cache, `kaizen-${todayKey()}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(backup));

  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Zapisz kopię zapasową' });
  await setSetting(db, 'last_export_at', backup.exportedAt);
}

/** Wybór pliku kopii. Zwraca sprawdzoną kopię albo null, gdy anulowano wybór. */
export async function pickBackup() {
  // '*/*', bo Dysk Google i komunikatory często oznaczają JSON jako zwykły plik binarny.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const text = await new File(result.assets[0].uri).text();
  return parseBackup(text);
}
