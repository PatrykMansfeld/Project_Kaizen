import { router } from 'expo-router';
import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getNotifications, syncHabitReminders } from './reminders';

/**
 * Działa w tle przez cały czas życia aplikacji: odświeża plan przypomnień po zmianach nawyków
 * (także odhaczeniu — dzisiejsze przypomnienie znika) i po powrocie do aplikacji.
 */
export function ReminderSync() {
  const db = useSQLiteContext();

  useEffect(() => {
    const Notifications = getNotifications();
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    void syncHabitReminders(db);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const dbSubscription = addDatabaseChangeListener((event) => {
      if (event.tableName !== 'habits' && event.tableName !== 'habit_logs') return;
      clearTimeout(timer);
      timer = setTimeout(() => void syncHabitReminders(db), 1000);
    });

    const appSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncHabitReminders(db);
    });

    // Stuknięcie w przypomnienie (gdy aplikacja działa w tle) otwiera zakładkę Nawyki.
    const responseSubscription = Notifications?.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.content.data?.url === '/nawyki') router.navigate('/nawyki');
    });

    return () => {
      clearTimeout(timer);
      dbSubscription.remove();
      appSubscription.remove();
      responseSubscription?.remove();
    };
  }, [db]);

  return null;
}
