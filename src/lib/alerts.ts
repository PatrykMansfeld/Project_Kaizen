import { Alert, Linking } from 'react-native';

/** Pytanie o potwierdzenie usunięcia (czerwony przycisk „Usuń”). */
export function confirmDelete(title: string, message: string | undefined, onConfirm: () => unknown) {
  Alert.alert(title, message, [
    { text: 'Anuluj', style: 'cancel' },
    { text: 'Usuń', style: 'destructive', onPress: () => void onConfirm() },
  ]);
}

/** Informacja o zablokowanym uprawnieniu z przejściem do ustawień telefonu. */
export function alertPermissionBlocked(title: string, message: string) {
  Alert.alert(title, message, [
    { text: 'Później', style: 'cancel' },
    { text: 'Otwórz ustawienia', onPress: () => void Linking.openSettings() },
  ]);
}
