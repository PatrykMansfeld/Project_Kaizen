import { router } from 'expo-router';
import { SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { EmojiBadge } from '@/components/emoji-badge';
import { Icon } from '@/components/icon';
import { StackHeader, useListScreenStyle } from '@/components/screen';
import { Separator } from '@/components/separator';
import { CATEGORIES_SQL, type FinanceCategory } from '@/db/finance';
import { useQuery } from '@/db/use-query';
import { formatMoney } from '@/features/finance/money';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

const open = (id: number | 'nowa') => router.push({ pathname: '/finanse/kategoria/[id]', params: { id: String(id) } });

/** Kategorie wydatków (z limitami) i przychodów. */
export default function FinanceCategoriesScreen() {
  const { colors, dark } = useTheme();
  const listStyle = useListScreenStyle();
  const { rows: categories } = useQuery<FinanceCategory>(CATEGORIES_SQL, [], ['finance_categories']);

  const sections = [
    { title: 'Wydatki', data: categories.filter((category) => category.type === 'expense') },
    { title: 'Przychody', data: categories.filter((category) => category.type === 'income') },
  ].filter((section) => section.data.length > 0);

  return (
    <>
      <StackHeader
        title="Kategorie"
        headerRight={<IconButton icon="add" accessibilityLabel="Nowa kategoria" onPress={() => open('nowa')} />}
      />
      <SectionList
        {...listStyle}
        sections={sections}
        keyExtractor={(category) => String(category.id)}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={Separator}
        renderSectionHeader={({ section }) => (
          <AppText variant="label" tone="textSecondary" style={styles.sectionHeader}>
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => (
          <Card variant="row" onPress={() => open(item.id)}>
            <EmojiBadge emoji={item.icon} color={paletteColor(item.color, dark)} size={36} />
            <View style={styles.body}>
              <AppText>{item.name}</AppText>
              {item.type === 'expense' ? (
                <AppText variant="caption" tone="textSecondary">
                  {item.monthly_budget ? `Limit ${formatMoney(item.monthly_budget)} / miesiąc` : 'Bez limitu'}
                </AppText>
              ) : null}
            </View>
            <Icon name="chevron_right" color={colors.textMuted} />
          </Card>
        )}
        ListFooterComponent={
          <AppText variant="caption" tone="textMuted" style={styles.hint}>
            Limit kategorii pokazuje, ile zostało w danym miesiącu. Budżet na wszystkie wydatki ustawisz na ekranie Wydatki.
          </AppText>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  body: { flex: 1, gap: 2 },
  hint: { paddingTop: spacing.lg },
});
