import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useQuery } from '@/db/use-query';
import { spacing } from '@/theme/theme';

import { getPermissionState, requestPermission, syncHabitReminders, type PermissionState } from './reminders';

type ReminderRow = { id: number; name: string; icon: string; reminder_time: string };

/** Stan zgody na powiadomienia i lista nawyków z przypomnieniem (w Ustawieniach). */
export function ReminderSettings() {
  const db = useSQLiteContext();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const { rows: reminders } = useQuery<ReminderRow>(
    `SELECT id, name, icon, reminder_time FROM habits
     WHERE archived = 0 AND reminder_time IS NOT NULL ORDER BY reminder_time`,
    [],
    ['habits'],
  );

  useEffect(() => {
    const refresh = () => void getPermissionState().then(setPermission);
    refresh();
    // Po powrocie z ustawień telefonu zgoda mogła się zmienić.
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => subscription.remove();
  }, []);

  const enable = async () => {
    const state = await requestPermission();
    setPermission(state);
    if (state === 'granted') void syncHabitReminders(db);
  };

  if (permission === null) return null;

  return (
    <View style={styles.container}>
      {permission === 'unavailable' ? (
        <AppText tone="textSecondary">Powiadomienia nie są dostępne w tej wersji aplikacji.</AppText>
      ) : permission === 'granted' ? (
        <AppText tone="textSecondary">
          Powiadomienia są włączone. Godzinę przypomnienia ustawisz w edycji nawyku.
        </AppText>
      ) : (
        <>
          <AppText tone="textSecondary">
            {permission === 'denied'
              ? 'Powiadomienia są zablokowane. Włącz je w ustawieniach telefonu, żeby dostawać przypomnienia.'
              : 'Włącz powiadomienia, żeby dostawać przypomnienia o nawykach.'}
          </AppText>
          {permission === 'denied' ? (
            <Button label="Otwórz ustawienia telefonu" icon="settings" variant="secondary" onPress={() => Linking.openSettings()} />
          ) : (
            <Button label="Włącz powiadomienia" icon="notifications" onPress={enable} />
          )}
        </>
      )}

      {reminders.length > 0 ? (
        <View style={styles.list}>
          {reminders.map((habit) => (
            <View key={habit.id} style={styles.row}>
              <AppText style={styles.name} numberOfLines={1}>
                {habit.icon} {habit.name}
              </AppText>
              <AppText variant="bodyStrong">{habit.reminder_time}</AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { flex: 1 },
});
