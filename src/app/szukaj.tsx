import { Stack, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { SearchField } from '@/components/search-field';
import { SEARCH_KINDS, searchEverything, type SearchKind, type SearchResult } from '@/features/search/search';
import { formatDayShort, relativeDayLabel } from '@/lib/dates';
import { normalizeForSearch, searchSnippet } from '@/lib/search';
import { useToday } from '@/lib/use-today';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const MIN_LENGTH = 2;

/** Tekst z wyróżnionym pierwszym trafieniem (pogrubienie + tło). */
function Highlighted({ text, query, lines }: { text: string; query: string; lines: number }) {
  const { colors } = useTheme();
  const { before, match, after } = searchSnippet(text, query);
  return (
    <AppText tone={lines > 1 ? 'textSecondary' : 'text'} variant={lines > 1 ? 'body' : 'bodyStrong'} numberOfLines={lines}>
      {before}
      {match ? (
        <AppText style={{ fontWeight: '700', color: colors.text, backgroundColor: withAlpha(colors.accent, 0.22) }}>
          {match}
        </AppText>
      ) : null}
      {after}
    </AppText>
  );
}

/** Globalna wyszukiwarka: zadania (z podzadaniami), notatki, dziennik, nawyki i treningi. */
export default function SearchScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const query = normalizeForSearch(text.trim());

  // Szukamy chwilę po ostatnim naciśnięciu klawisza, a starsze odpowiedzi ignorujemy.
  useEffect(() => {
    if (query.length < MIN_LENGTH) {
      setResults(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      searchEverything(db, query).then((found) => active && setResults(found));
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [db, query]);

  const sections = (Object.keys(SEARCH_KINDS) as SearchKind[])
    .map((kind) => ({ kind, data: (results ?? []).filter((result) => result.kind === kind) }))
    .filter((section) => section.data.length > 0);

  return (
    <>
      <Stack.Screen options={{ title: 'Szukaj' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.field}>
          <SearchField
            value={text}
            onChangeText={setText}
            placeholder="Zadania, notatki, dziennik…"
            autoFocus
          />
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(result) => result.key}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
          renderSectionHeader={({ section }) => (
            <AppText variant="label" tone="textSecondary" style={styles.sectionHeader}>
              {SEARCH_KINDS[section.kind].label} ({section.data.length})
            </AppText>
          )}
          renderItem={({ item }) => {
            const kind = SEARCH_KINDS[item.kind];
            return (
              <Pressable
                onPress={() => router.push(item.target)}
                android_ripple={{ color: colors.border }}
                style={[styles.row, { backgroundColor: colors.surface }]}>
                <Icon name={kind.icon} size={20} color={colors[kind.color]} />
                <View style={styles.body}>
                  <Highlighted text={item.title} query={query} lines={1} />
                  {item.body.trim() ? <Highlighted text={item.body} query={query} lines={2} /> : null}
                  {item.date ? (
                    <AppText variant="caption" tone="textMuted">
                      {relativeDayLabel(item.date, today) ?? formatDayShort(item.date, today)}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            results === null ? (
              <EmptyState
                icon="search"
                title="Czego szukasz?"
                description="Wpisz co najmniej 2 znaki. Polskie znaki są opcjonalne — „zolw” znajdzie „żółw”."
              />
            ) : (
              <EmptyState icon="search_off" title="Nic nie znaleziono" description={`Brak wyników dla „${text.trim()}”.`} />
            )
          }
        />
      </View>
    </>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  field: { padding: spacing.lg, paddingBottom: spacing.sm },
  list: { flexGrow: 1, paddingHorizontal: spacing.lg },
  sectionHeader: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  body: { flex: 1, gap: 2 },
  separator: { height: spacing.sm },
});
