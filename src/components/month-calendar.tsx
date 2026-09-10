import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { MONTHS, WEEKDAYS_SHORT, monthWeeks, shiftMonth, type DateKey, type YearMonth } from '@/lib/dates';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  today: DateKey;
  selected: DateKey | null;
  onSelect: (day: DateKey) => void;
  month: YearMonth;
  onMonthChange: (month: YearMonth) => void;
  /** Kolorowe kropki pod dniem, np. z modułów. */
  dots?: Map<DateKey, string[]>;
};

/** Siatka miesiąca (pn–nd) z przełączaniem miesięcy. */
export function MonthCalendar({ today, selected, onSelect, month, onMonthChange, dots }: Props) {
  const { colors } = useTheme();
  const monthPrefix = `${month.year}-${String(month.month + 1).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="chevron_left"
          accessibilityLabel="Poprzedni miesiąc"
          onPress={() => onMonthChange(shiftMonth(month, -1))}
        />
        <AppText variant="bodyStrong" style={styles.monthTitle}>
          {MONTHS[month.month]} {month.year}
        </AppText>
        <IconButton
          icon="chevron_right"
          accessibilityLabel="Następny miesiąc"
          onPress={() => onMonthChange(shiftMonth(month, 1))}
        />
      </View>

      <View style={styles.row}>
        {WEEKDAYS_SHORT.map((name) => (
          <AppText key={name} variant="caption" tone="textMuted" style={styles.weekday}>
            {name}
          </AppText>
        ))}
      </View>

      {monthWeeks(month.year, month.month).map((week) => (
        <View key={week[0]} style={styles.row}>
          {week.map((day) => {
            const inMonth = day.startsWith(monthPrefix);
            const isSelected = day === selected;
            const isToday = day === today;
            const dayDots = dots?.get(day);
            return (
              <Pressable
                key={day}
                onPress={() => onSelect(day)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={styles.cell}>
                <View
                  style={[
                    styles.day,
                    isSelected && { backgroundColor: colors.accent },
                    isToday && !isSelected && { borderColor: colors.accent, borderWidth: 1.5 },
                  ]}>
                  <AppText
                    style={{
                      color: isSelected ? colors.onAccent : inMonth ? colors.text : colors.textMuted,
                      fontWeight: isToday || isSelected ? '700' : '400',
                    }}>
                    {Number(day.slice(8))}
                  </AppText>
                </View>
                {dots ? (
                  <View style={styles.dots}>
                    {dayDots?.map((color, index) => (
                      <View key={index} style={[styles.dot, { backgroundColor: color, opacity: inMonth ? 1 : 0.4 }]} />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  monthTitle: { flex: 1, textAlign: 'center', textTransform: 'capitalize' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2, gap: 3 },
  day: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: radius.full },
});
