import { addDatabaseChangeListener, useSQLiteContext, type SQLiteBindParams } from 'expo-sqlite';
import { useEffect, useState } from 'react';

type Table =
  | 'workouts'
  | 'workout_sets'
  | 'exercises'
  | 'habits'
  | 'habit_logs'
  | 'tasks'
  | 'notes'
  | 'journal_entries'
  | 'settings';

/**
 * Wykonuje SELECT i ponawia go automatycznie, gdy zmieni się któraś z tabel w `tables`.
 * Dzięki temu ekran listy sam się odświeża po zapisie na ekranie edycji.
 */
export function useQuery<T>(sql: string, params: SQLiteBindParams, tables: Table[]) {
  const db = useSQLiteContext();
  const [state, setState] = useState<{ rows: T[]; loaded: boolean }>({ rows: [], loaded: false });

  // Tablice z propsów są co render nowe — porównujemy je po zawartości.
  const paramsKey = JSON.stringify(params);
  const tablesKey = tables.join(',');

  useEffect(() => {
    const watched = new Set(tablesKey.split(','));
    let latestRequest = 0;
    let refreshScheduled = false;
    let active = true;

    const run = () => {
      refreshScheduled = false;
      const request = ++latestRequest;
      db.getAllAsync<T>(sql, JSON.parse(paramsKey)).then(
        (rows) => {
          // Ignorujemy wynik, jeśli w międzyczasie wystartowało nowsze zapytanie.
          if (active && request === latestRequest) setState({ rows, loaded: true });
        },
        (error) => console.error('useQuery:', error),
      );
    };

    run();

    const subscription = addDatabaseChangeListener((event) => {
      if (!watched.has(event.tableName) || refreshScheduled) return;
      // Seria zmian (np. transakcja) daje jedno odświeżenie zamiast wielu.
      refreshScheduled = true;
      setTimeout(run, 0);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [db, sql, paramsKey, tablesKey]);

  return state;
}
