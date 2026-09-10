import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { nextHabitCount, type Habit } from '@/db/habits';
import { WEEKDAYS_SHORT, type DateKey } from '@/lib/dates';
import { radius, spacing, withAlpha } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { formatStreak, habitColor } from './palette';

export function HabitIcon({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={[
        styles.iconBubble,
        { width: size, height: size, backgroundColor: withAlpha(color, 0.18) },
      ]}>
      <Text style={{ fontSize: size * 0.5 }}>{icon}</Text>
    </View>
  );
}

type ProgressProps = {
  count: number;
  target: number;
  color: string;
  onPress: () => void;
  onLongPress: () => void;
  size?: number;
};

/** Stuknięcie: +1 (po celu — zero), przytrzymanie: −1. */
export function HabitProgressButton({ count, target, color, onPress, onLongPress, size = 44 }: ProgressProps) {
  const { colors } = useTheme();
  const done = count >= target;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${count} z ${target}. Stuknij, aby dodać, przytrzymaj, aby cofnąć.`}
      style={[
        styles.progress,
        { width: size, height: size },
        done
          ? { backgroundColor: color, borderColor: color }
          : { borderColor: count > 0 ? color : colors.border, backgroundColor: withAlpha(color, count / target / 3) },
      ]}>
      {target === 1 || done ? (
        <Icon name="check" size={size * 0.5} color={done ? colors.onAccent : colors.textMuted} />
      ) : (
        <AppText variant="caption" style={{ fontWeight: '700', color: colors.text }}>
          {count}/{target}
        </AppText>
      )}
    </Pressable>
  );
}

type Props = {
  habit: Habit;
  week: DateKey[];
  today: DateKey;
  counts: Map<DateKey, number>;
  streak: number;
  onChangeCount: (date: DateKey, count: number) => void;
  onPress: () => void;
};

export function HabitCard({ habit, week, today, counts, streak, onChangeCount, onPress }: Props) {
  const { colors, dark } = useTheme();
  const color = habitColor(habit.color, dark);
  const target = habit.target_per_day;
  const todayCount = counts.get(today) ?? 0;

  const increment = (date: DateKey) => onChangeCount(date, nextHabitCount(counts.get(date) ?? 0, target));
  const decrement = (date: DateKey) => {
    const count = counts.get(date) ?? 0;
    if (count > 0) onChangeCount(date, count - 1);
  };

  const meta = [
    streak > 0 ? formatStreak(streak) : null,
    target > 1 ? `${target}× dziennie` : null,
    habit.reminder_time ? `🔔 ${habit.reminder_time}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <HabitIcon icon={habit.icon} color={color} />
        <View style={styles.titles}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {habit.name}
          </AppText>
          {meta ? (
            <AppText variant="caption" tone="textSecondary">
              {meta}
            </AppText>
          ) : null}
        </View>
        <HabitProgressButton
          count={todayCount}
          target={target}
          color={color}
          onPress={() => increment(today)}
          onLongPress={() => decrement(today)}
        />
      </View>

      <View style={styles.week}>
        {week.map((day, index) => {
          const count = counts.get(day) ?? 0;
          const future = day > today;
          return (
            <Pressable
              key={day}
              disabled={future}
              onPress={() => increment(day)}
              onLongPress={() => decrement(day)}
              accessibilityLabel={`${WEEKDAYS_SHORT[index]}: ${count} z ${target}`}
              style={styles.dayColumn}>
              <AppText
                variant="caption"
                style={{ color: day === today ? colors.text : colors.textMuted, fontWeight: day === today ? '700' : '400' }}>
                {WEEKDAYS_SHORT[index]}
              </AppText>
              <View
                style={[
                  styles.cell,
                  {
                    backgroundColor: count > 0 ? withAlpha(color, 0.25 + 0.75 * Math.min(count / target, 1)) : colors.surfaceAlt,
                    opacity: future ? 0.4 : 1,
                  },
                  day === today && { borderWidth: 2, borderColor: color },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titles: { flex: 1, gap: 2 },
  iconBubble: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  progress: {
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  week: { flexDirection: 'row', gap: spacing.xs },
  dayColumn: { flex: 1, alignItems: 'center', gap: spacing.xs },
  cell: { alignSelf: 'stretch', height: 24, borderRadius: 6 },
});
