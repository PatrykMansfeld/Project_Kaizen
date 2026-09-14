import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { Chip, ChipRow } from '@/components/chip';
import { EmojiBadge } from '@/components/emoji-badge';
import { ScrollScreen } from '@/components/screen';
import { TRIP_ITEMS_SQL, TRIP_SQL, TRIP_TABLES, type TripItem, type TripWithTotals } from '@/db/trips';
import { useQuery } from '@/db/use-query';
import { formatMoney } from '@/features/finance/money';
import { ExpensesTab } from '@/features/trips/expenses-tab';
import { PackingTab } from '@/features/trips/packing-tab';
import { PhotosTab } from '@/features/trips/photos-tab';
import { PlanTab } from '@/features/trips/plan-tab';
import { tripPhase, tripStatusLabel } from '@/features/trips/trips';
import { formatDateRange } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Tab = 'plan' | 'pack' | 'expenses' | 'photos';

/** Podróż (/podroz/3): plan dzień po dniu, pakowanie, wydatki i zdjęcia. */
export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const today = useToday();
  const { dark } = useTheme();
  const [tab, setTab] = useState<Tab | null>(null);

  const { rows: tripRows, loaded } = useQuery<TripWithTotals>(TRIP_SQL, { $id: tripId }, TRIP_TABLES);
  const { rows: items } = useQuery<TripItem>(TRIP_ITEMS_SQL, { $trip: tripId }, ['trip_items']);
  const trip = tripRows[0];

  // Podróż usunięta (albo zły adres) — wracamy do listy.
  useEffect(() => {
    if (loaded && !trip) router.back();
  }, [loaded, trip]);

  if (!trip) return <ScrollScreen title="Podróż">{null}</ScrollScreen>;

  const phase = tripPhase(trip, today);
  // Domyślnie to, co teraz najważniejsze: przed wyjazdem pakowanie, w trakcie plan, po powrocie wspomnienia.
  const current: Tab = tab ?? (phase === 'upcoming' ? 'pack' : phase === 'ongoing' ? 'plan' : 'photos');
  const packItems = items.filter((item) => item.kind === 'pack');
  const planItems = items.filter((item) => item.kind === 'plan');
  const color = paletteColor(trip.color, dark);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'plan', label: planItems.length ? `Plan · ${planItems.length}` : 'Plan' },
    { key: 'pack', label: packItems.length ? `Pakowanie · ${trip.pack_done}/${trip.pack_total}` : 'Pakowanie' },
    { key: 'expenses', label: trip.spent ? `Wydatki · ${formatMoney(trip.spent)}` : 'Wydatki' },
    { key: 'photos', label: trip.photo_count ? `Zdjęcia · ${trip.photo_count}` : 'Zdjęcia' },
  ];

  return (
    <ScrollScreen
      title={trip.name}
      gap={spacing.lg}
      headerRight={
        <IconButton
          icon="edit"
          accessibilityLabel="Edytuj podróż"
          onPress={() => router.push({ pathname: '/podroz/edycja/[id]', params: { id: String(trip.id) } })}
        />
      }>
      <Card style={styles.hero}>
        <EmojiBadge emoji={trip.icon} color={color} size={56} />
        <View style={styles.flex}>
          {trip.destination ? <AppText variant="bodyStrong">{trip.destination}</AppText> : null}
          <AppText tone="textSecondary">{formatDateRange(trip.start_date, trip.end_date, today)}</AppText>
          <AppText variant="caption" tone={phase === 'past' ? 'textMuted' : 'accent'} style={styles.status}>
            {tripStatusLabel(trip, today)}
          </AppText>
        </View>
      </Card>

      <ChipRow scroll>
        {tabs.map((option) => (
          <Chip key={option.key} label={option.label} selected={current === option.key} onPress={() => setTab(option.key)} />
        ))}
      </ChipRow>

      {current === 'plan' ? <PlanTab trip={trip} items={planItems} today={today} /> : null}
      {current === 'pack' ? <PackingTab trip={trip} items={packItems} /> : null}
      {current === 'expenses' ? <ExpensesTab trip={trip} today={today} /> : null}
      {current === 'photos' ? <PhotosTab trip={trip} /> : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  status: { fontWeight: '600' },
});
