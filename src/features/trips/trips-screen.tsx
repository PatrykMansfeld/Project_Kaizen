import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button, IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { EmojiBadge } from '@/components/emoji-badge';
import { EmptyState } from '@/components/empty-state';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TRIPS_SQL, TRIP_TABLES, type TripWithTotals } from '@/db/trips';
import { useQuery } from '@/db/use-query';
import { formatMoney } from '@/features/finance/money';
import { Meter } from '@/features/stats/charts';
import { groupBy } from '@/lib/collections';
import { formatDateRange, type DateKey } from '@/lib/dates';
import { plural } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { tripPhase, tripStatusLabel, tripsYearSummary } from './trips';

export const openTrip = (id: number) => router.push({ pathname: '/podroz/[id]', params: { id: String(id) } });

const newTrip = () => router.push({ pathname: '/podroz/edycja/[id]', params: { id: 'nowa' } });

/** Podróże: trwająca, nadchodzące (odliczanie i pakowanie) i minione, po latach. */
export function TripsScreen() {
  const today = useToday();
  const { colors } = useTheme();
  const { rows: trips, loaded } = useQuery<TripWithTotals>(TRIPS_SQL, [], TRIP_TABLES);

  const ongoing = trips.filter((trip) => tripPhase(trip, today) === 'ongoing');
  // Nadchodzące od najbliższej.
  const upcoming = trips.filter((trip) => tripPhase(trip, today) === 'upcoming').reverse();
  const past = trips.filter((trip) => tripPhase(trip, today) === 'past');
  const pastByYear = groupBy(past, (trip) => Number(trip.start_date.slice(0, 4)));

  return (
    <ScrollScreen title="Podróże" headerRight={<IconButton icon="add" accessibilityLabel="Nowa podróż" onPress={newTrip} />}>
      {loaded && trips.length === 0 ? (
        <>
          <EmptyState
            icon="flight"
            color={colors.tasks}
            title="Dokąd jedziesz?"
            description="Zaplanuj wyjazd: plan dnia po dniu, lista pakowania z gotowych szablonów, budżet i wydatki z podróży, a potem zdjęcia na pamiątkę."
          />
          <Button label="Zaplanuj podróż" icon="add" onPress={newTrip} />
        </>
      ) : null}

      {ongoing.length > 0 ? (
        <Section title="Teraz">
          {ongoing.map((trip) => (
            <TripCard key={trip.id} trip={trip} today={today} />
          ))}
        </Section>
      ) : null}

      {upcoming.length > 0 ? (
        <Section title="Nadchodzące">
          {upcoming.map((trip) => (
            <TripCard key={trip.id} trip={trip} today={today} />
          ))}
        </Section>
      ) : null}

      {[...pastByYear].map(([year, yearTrips]) => {
        const summary = tripsYearSummary(yearTrips, year);
        const meta = [plural(summary.days, ['dzień', 'dni', 'dni']), summary.spent ? formatMoney(summary.spent) : null]
          .filter(Boolean)
          .join(' · ');
        return (
          <Section key={year} title={`${year} · ${plural(summary.count, ['wyjazd', 'wyjazdy', 'wyjazdów'])}`} meta={meta}>
            {yearTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} today={today} />
            ))}
          </Section>
        );
      })}
    </ScrollScreen>
  );
}

/** Karta podróży: okładka (pierwsze zdjęcie) albo emoji, termin, odliczanie, pakowanie i budżet. */
function TripCard({ trip, today }: { trip: TripWithTotals; today: DateKey }) {
  const { colors, dark } = useTheme();
  const color = paletteColor(trip.color, dark);
  const phase = tripPhase(trip, today);
  const details = [trip.destination, formatDateRange(trip.start_date, trip.end_date, today)].filter(Boolean).join(' · ');
  const showPacking = phase === 'upcoming' && trip.pack_total > 0;
  const overBudget = trip.budget !== null && trip.spent > trip.budget;

  return (
    <Card onPress={() => openTrip(trip.id)} style={styles.card} accessibilityLabel={`${trip.name}, ${details}`}>
      <View style={styles.header}>
        {trip.cover_uri ? (
          <Image source={{ uri: trip.cover_uri }} style={[styles.cover, { backgroundColor: colors.surfaceAlt }]} contentFit="cover" />
        ) : (
          <EmojiBadge emoji={trip.icon} color={color} size={48} />
        )}
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {trip.name}
          </AppText>
          <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
            {details}
          </AppText>
        </View>
        <AppText variant="caption" tone={phase === 'past' ? 'textMuted' : 'accent'} style={styles.status}>
          {tripStatusLabel(trip, today)}
        </AppText>
      </View>

      {showPacking ? (
        <View style={styles.meter}>
          <Meter value={trip.pack_done / trip.pack_total} color={color} />
          <AppText variant="caption" tone="textMuted">
            Spakowane {trip.pack_done} z {trip.pack_total}
          </AppText>
        </View>
      ) : null}

      {phase !== 'upcoming' && (trip.spent > 0 || trip.photo_count > 0) ? (
        <AppText variant="caption" tone={overBudget ? 'danger' : 'textMuted'}>
          {[
            trip.spent > 0 ? `Wydane ${formatMoney(trip.spent)}${trip.budget ? ` z ${formatMoney(trip.budget)}` : ''}` : null,
            trip.photo_count > 0 ? plural(trip.photo_count, ['zdjęcie', 'zdjęcia', 'zdjęć']) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  cover: { width: 48, height: 48, borderRadius: radius.md },
  status: { fontWeight: '600' },
  meter: { gap: spacing.xs },
});
