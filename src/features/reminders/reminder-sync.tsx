import { router, type Href } from 'expo-router';
import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getNotifications, syncReminders } from './reminders';

/** Tabele, których zmiana może zmienić plan przypomnień. */
const WATCHED = new Set([
  'habits',
  'habit_logs',
  'tasks',
  'settings',
  'weekly_reviews',
  'medications',
  'medication_logs',
  'recurring_bills',
  'home_chores',
  'warranties',
]);

/**
 * Działa w tle przez cały czas życia aplikacji: odświeża plan przypomnień po zmianach
 * (np. odhaczenie nawyku usuwa dzisiejsze przypomnienie) i po powrocie do aplikacji.
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

    void syncReminders(db);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const dbSubscription = addDatabaseChangeListener((event) => {
      if (!WATCHED.has(event.tableName)) return;
      clearTimeout(timer);
      timer = setTimeout(() => void syncReminders(db), 1000);
    });

    const appSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncReminders(db);
    });

    // Stuknięcie w powiadomienie (gdy aplikacja działa w tle) otwiera właściwy ekran.
    const responseSubscription = Notifications?.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
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
