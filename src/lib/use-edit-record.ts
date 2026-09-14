import { router } from 'expo-router';
import { useEffect, useState } from 'react';

/**
 * Wczytuje rekord do formularza edycji. Nowy rekord (`id` = null) jest gotowy od razu; istniejący trafia
 * do `apply`, a gdy go nie ma (np. usunięty na innym ekranie) — wracamy do poprzedniego ekranu.
 * Zwraca, czy formularz jest gotowy. `load` i `apply` są brane z pierwszego renderu dla danego `id`.
 */
export function useEditRecord<T>(
  id: number | string | null,
  load: () => Promise<T | null | undefined>,
  apply: (record: T) => void,
) {
  const [loaded, setLoaded] = useState(id === null);

  useEffect(() => {
    if (id === null) return;
    let active = true;
    load().then((record) => {
      if (!active) return;
      if (!record) {
        router.back();
        return;
      }
      apply(record);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
    // Formularz wczytujemy raz na rekord — nowe funkcje z kolejnych renderów niczego nie zmieniają.
  }, [id]);

  return loaded;
}
