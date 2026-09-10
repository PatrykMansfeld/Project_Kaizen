import { useCallback, useEffect, useRef } from 'react';

/**
 * Autozapis: `schedule(value)` zapisuje wartość po `delay` ms bez kolejnych zmian.
 * Zapisy wykonują się po kolei (np. pierwszy INSERT kończy się przed kolejnym UPDATE),
 * a przy zamknięciu ekranu oczekująca zmiana jest zapisywana od razu.
 */
export function useAutosave<T>(save: (value: T) => Promise<void>, delay = 600) {
  const saveRef = useRef(save);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ value: T } | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    saveRef.current = save;
  });

  /** Zapisuje oczekującą zmianę od razu. Zwraca obietnicę zakończenia wszystkich zapisów. */
  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const next = pending.current;
    if (next) {
      pending.current = null;
      queue.current = queue.current
        .then(() => saveRef.current(next.value))
        .catch((error) => console.error('Autozapis:', error));
    }
    return queue.current;
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  useEffect(() => () => void flush(), [flush]);

  return { schedule, flush };
}
