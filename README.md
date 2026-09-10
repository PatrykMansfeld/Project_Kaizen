# Kaizen

Osobisty tracker codziennej rutyny na Androida (Expo).

- **Dziś** — kalendarz miesiąca z kropkami z modułów, agenda dnia, dziennik (nastrój 1–5 + tekst)
- **Nawyki** — cele 1–5× dziennie, serie, tygodniowa heat-mapa
- **Zadania** — priorytety, terminy, filtry Otwarte / Na dziś / Zrobione
- **Aktywność** — treningi: spacer, bieg, rower, siłownia, pływanie, inne
- **Notatki** — szukajka, przypinanie, autozapis

Dane są przechowywane lokalnie w SQLite (`expo-sqlite`). Kopię zapasową (plik JSON) eksportuje się
i przywraca w **Dziś → ⚙️ Ustawienia**. Tam też widać stan przypomnień o nawykach.

## Uruchomienie

```bash
npm install
npx expo start
```

Zeskanuj kod QR w aplikacji Expo Go na Androidzie.

## Struktura

```
src/
  app/          ekrany (Expo Router); (tabs)/ to pasek zakładek, reszta to ekrany edycji i dnia
  components/   wspólne komponenty UI (przyciski, kalendarz miesiąca, wybór daty…)
  features/     komponenty i logika konkretnych modułów (nawyki, zadania, notatki, dzień…)
  db/           migracje schematu, zapytania modułów i hook useQuery
  lib/          daty ('YYYY-MM-DD', tydzień od poniedziałku) i inne narzędzia
  theme/        kolory (jasny/ciemny), odstępy, zaokrąglenia
```
