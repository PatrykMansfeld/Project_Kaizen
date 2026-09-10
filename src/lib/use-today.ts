import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayKey } from './dates';

/**
 * Dzisiejsza data, która sama się aktualizuje o północy i po powrocie do aplikacji
 * (np. gdy była otwarta w tle przez noc).
 */
export function useToday() {
  const [today, setToday] = useState(todayKey);

  useEffect(() => {
    const refresh = () => setToday(todayKey());

    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(refresh, nextMidnight.getTime() - now.getTime() + 1000);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [today]);

  return today;
}
