import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmojiBadge } from '@/components/emoji-badge';
import type { Transaction } from '@/db/finance';
import { paletteColor } from '@/theme/palette';
import { useTheme } from '@/theme/use-theme';

import { formatSignedMoney } from './money';

/** Wiersz wydatku / przychodu; stuknięcie otwiera edycję. */
export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const { colors, dark } = useTheme();
  const color = transaction.category_color ? paletteColor(transaction.category_color, dark) : colors.textMuted;

  return (
    <Card
      variant="row"
      style={styles.row}
      onPress={() => router.push({ pathname: '/finanse/transakcja/[id]', params: { id: String(transaction.id) } })}>
      <EmojiBadge emoji={transaction.category_icon ?? (transaction.type === 'income' ? '💰' : '📦')} color={color} size={36} />
      <View style={styles.body}>
        <AppText numberOfLines={1}>{transaction.category_name ?? 'Bez kategorii'}</AppText>
        {transaction.note ? (
          <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
            {transaction.note}
          </AppText>
        ) : null}
      </View>
      <AppText variant="bodyStrong">{formatSignedMoney(transaction.amount, transaction.type)}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 10 },
  body: { flex: 1, gap: 2 },
});
