import { alertPermissionBlocked } from '@/lib/alerts';

import { requestPermission } from './reminders';

/**
 * Prosi o zgodę na powiadomienia po ustawieniu przypomnienia. Gdy zgoda jest zablokowana, wyjaśnia,
 * że godzina się zapisze, ale powiadomienie nie przyjdzie. W Expo Go ('unavailable') nic nie pokazuje —
 * tam informacja jest pod ustawieniem przypomnienia.
 */
export async function requestPermissionOrWarn(message: string) {
  if ((await requestPermission()) === 'denied') alertPermissionBlocked('Powiadomienia są zablokowane', message);
}
