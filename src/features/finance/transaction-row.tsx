import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmojiBadge } from '@/components/emoji-badge';
import type { Transaction } from '@/db/finance';
import { paletteColor } from '@/theme/palette';
import { useTheme } from '@/theme/use-theme';

import { formatSignedMoney } from './money';

/** Wiersz wydatku / przychodu; stuknięcie otwiera edycję. `hideTrip` — na ekranie samej podróży. */
export function TransactionRow({ transaction, hideTrip = false }: { transaction: Transaction; hideTrip?: boolean }) {
  const { colors, dark } = useTheme();
  const color = transaction.category_color ? paletteColor(transaction.category_color, dark) : colors.textMuted;
  const trip = !hideTrip && transaction.trip_name ? `${transaction.trip_icon ?? '✈️'} ${transaction.trip_name}` : null;
  const detail = [trip, transaction.note].filter(Boolean).join(' · ');

  return (
    <Card
      variant="row"
      style={styles.row}
      onPress={() => router.push({ pathname: '/finanse/transakcja/[id]', params: { id: String(transaction.id) } })}>
      <EmojiBadge emoji={transaction.category_icon ?? (transaction.type === 'income' ? '💰' : '📦')} color={color} size={36} />
      <View style={styles.body}>
        <AppText numberOfLines={1}>{transaction.category_name ?? 'Bez kategorii'}</AppText>
        {detail ? (
          <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
            {detail}
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
