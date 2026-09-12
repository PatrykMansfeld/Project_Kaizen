import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button, IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyLine } from '@/components/empty-state';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { SESSIONS_SQL, SKILL_SQL, type PracticeSession, type Skill } from '@/db/skills';
import { useQuery } from '@/db/use-query';
import { SessionSheet } from '@/features/skills/session-sheet';
import { formatHours, weeklyMinutes, weeksToGoal } from '@/features/skills/skills';
import { ColumnChart, Meter, StatRow, StatTile } from '@/features/stats/charts';
import { formatDayRelative } from '@/lib/dates';
import { formatDuration, plural } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { paletteColor } from '@/theme/palette';
import { useTheme } from '@/theme/use-theme';

/** Umiejętność: postęp do celu, tygodnie praktyki i historia sesji (/umiejetnosc/3). */
export default function SkillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const skillId = Number(id);
  const today = useToday();
  const { dark, colors } = useTheme();
  const [sheet, setSheet] = useState<{ skillId: number; session?: PracticeSession } | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const { rows: skillRows, loaded } = useQuery<Skill>(SKILL_SQL, { $id: skillId }, ['skills']);
  const { rows: sessions } = useQuery<PracticeSession>(SESSIONS_SQL, { $skill: skillId }, ['practice_sessions']);
  const skill = skillRows[0];

  // Umiejętność usunięta (albo zły adres) — wracamy do listy.
  useEffect(() => {
    if (loaded && !skill) router.back();
  }, [loaded, skill]);
  const color = skill ? paletteColor(skill.color, dark) : colors.accent;

  const total = sessions.reduce((sum, session) => sum + session.minutes, 0);
  const monthPrefix = today.slice(0, 7);
  const month = sessions.filter((session) => session.date.startsWith(monthPrefix)).reduce((sum, session) => sum + session.minutes, 0);
  const weeks = weeklyMinutes(sessions, today);
  const recentAverage = Math.round(weeks.slice(0, -1).reduce((sum, week) => sum + week.minutes, 0) / (weeks.length - 1));
  const toGoal = weeksToGoal(total, skill?.goal_hours ?? null, recentAverage);
  const selected = weeks.find((week) => week.start === selectedWeek);

  return (
    <>
      <ScrollScreen
        title={skill ? `${skill.icon} ${skill.name}` : 'Umiejętność'}
        headerRight={
          <IconButton
            icon="edit"
            accessibilityLabel="Edytuj umiejętność"
            onPress={() => router.push({ pathname: '/umiejetnosc/edycja/[id]', params: { id: String(skillId) } })}
          />
        }>
        <StatRow>
          <StatTile label="Łącznie" value={formatDuration(total)} detail={plural(sessions.length, ['sesja', 'sesje', 'sesji'])} />
          <StatTile label="Ten miesiąc" value={formatDuration(month)} />
          <StatTile label="Średnio" value={formatDuration(recentAverage)} detail="tygodniowo" />
        </StatRow>

        {skill?.goal_hours ? (
          <Card>
            <AppText variant="bodyStrong">
              Cel: {skill.goal_hours} h · {formatHours(total)}
            </AppText>
            <Meter value={total / (skill.goal_hours * 60)} color={color} />
            <AppText variant="caption" tone="textSecondary">
              {total >= skill.goal_hours * 60
                ? '🏆 Cel osiągnięty!'
                : toGoal !== null
                  ? `Przy obecnym tempie cel osiągniesz za ok. ${plural(toGoal, ['tydzień', 'tygodnie', 'tygodni'])}.`
                  : 'Zapisuj sesje, a policzę, kiedy osiągniesz cel.'}
            </AppText>
          </Card>
        ) : null}

        <Card>
          <AppText variant="caption" tone="textSecondary">
            {selected ? `Tydzień od ${formatDayRelative(selected.start, today)}: ${formatDuration(selected.minutes)}` : 'Minuty praktyki w ostatnich 8 tygodniach'}
          </AppText>
          <ColumnChart
            columns={weeks.map((week, index) => ({
              key: week.start,
              value: week.minutes,
              axisLabel: index === weeks.length - 1 ? 'teraz' : index % 2 === 0 ? `${Number(week.start.slice(8))}.${week.start.slice(5, 7)}` : undefined,
              accessibilityLabel: `Tydzień od ${week.start}: ${formatDuration(week.minutes)}`,
            }))}
            max={Math.max(...weeks.map((week) => week.minutes), 60)}
            color={color}
            height={120}
            selectedKey={selectedWeek}
            onSelect={(key) => setSelectedWeek(key === selectedWeek ? null : key)}
          />
        </Card>

        <Button label="Dodaj sesję" icon="add" onPress={() => setSheet({ skillId })} />

        <Section title="Sesje">
          {sessions.length === 0 ? <EmptyLine text="Brak sesji — dodaj pierwszą." /> : null}
          {sessions.slice(0, 50).map((session) => (
            <Card key={session.id} variant="row" onPress={() => setSheet({ skillId, session })}>
              <View style={styles.flex}>
                <AppText>{formatDayRelative(session.date, today)}</AppText>
                {session.note ? (
                  <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
                    {session.note}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="bodyStrong">{formatDuration(session.minutes)}</AppText>
            </Card>
          ))}
        </Section>
      </ScrollScreen>
      <SessionSheet target={sheet} today={today} onClose={() => setSheet(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
});
