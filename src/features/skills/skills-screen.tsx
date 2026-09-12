import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { Chip, ChipRow } from '@/components/chip';
import { EmojiBadge } from '@/components/emoji-badge';
import { EmptyState } from '@/components/empty-state';
import { ScrollScreen } from '@/components/screen';
import { SKILLS_SQL, SKILL_TABLES, addSession, type SkillWithTotals } from '@/db/skills';
import { useQuery } from '@/db/use-query';
import { Meter } from '@/features/stats/charts';
import { startOfWeek } from '@/lib/dates';
import { formatDuration } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { QUICK_MINUTES, formatHours } from './skills';

/** Umiejętności: godziny praktyki, cel i szybkie dopisanie czasu. */
export function SkillsScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const { colors, dark } = useTheme();
  const { rows: skills, loaded } = useQuery<SkillWithTotals>(SKILLS_SQL, { $weekStart: startOfWeek(today) }, SKILL_TABLES);

  const openEditor = () => router.push({ pathname: '/umiejetnosc/edycja/[id]', params: { id: 'nowa' } });

  return (
    <ScrollScreen
      title="Umiejętności"
      gap={spacing.md}
      headerRight={<IconButton icon="add" accessibilityLabel="Nowa umiejętność" onPress={openEditor} />}>
      {loaded && skills.length === 0 ? (
        <EmptyState
          icon="school"
          title="Co ćwiczysz?"
          description="Dodaj umiejętność, np. gitarę, angielski albo programowanie, i zapisuj czas praktyki. Zobaczysz, jak rosną godziny."
        />
      ) : null}
      {skills.map((skill) => {
        const color = paletteColor(skill.color, dark);
        const goalMinutes = skill.goal_hours ? skill.goal_hours * 60 : null;
        return (
          <Card key={skill.id} onPress={() => router.push({ pathname: '/umiejetnosc/[id]', params: { id: String(skill.id) } })}>
            <View style={styles.header}>
              <EmojiBadge emoji={skill.icon} color={color} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{skill.name}</AppText>
                <AppText variant="caption" tone="textSecondary">
                  {skill.total_minutes ? `${formatDuration(skill.total_minutes)} łącznie` : 'Jeszcze bez sesji'}
                  {skill.week_minutes ? ` · ${formatDuration(skill.week_minutes)} w tym tygodniu` : ''}
                </AppText>
              </View>
            </View>
            {goalMinutes ? (
              <View style={styles.goal}>
                <Meter value={skill.total_minutes / goalMinutes} color={color} />
                <AppText variant="caption" tone="textMuted">
                  {formatHours(skill.total_minutes)} z {skill.goal_hours} h · {Math.min(100, Math.round((skill.total_minutes / goalMinutes) * 100))}%
                </AppText>
              </View>
            ) : null}
            <ChipRow>
              {QUICK_MINUTES.map((minutes) => (
                <Chip
                  key={minutes}
                  label={`+${formatDuration(minutes)}`}
                  icon="add"
                  iconColor={colors.accent}
                  selected={false}
                  onPress={() => addSession(db, { skill_id: skill.id, date: today, minutes, note: '' })}
                />
              ))}
            </ChipRow>
          </Card>
        );
      })}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  goal: { gap: spacing.xs },
});
