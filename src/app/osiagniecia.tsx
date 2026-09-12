import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { getSetting, setSetting } from '@/db/settings';
import { achievementList, loadAchievementStats, parseSeen, type Achievement } from '@/features/achievements/achievements';
import { Meter } from '@/features/stats/charts';
import { useToday } from '@/lib/use-today';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Osiągnięcia: odznaki za serie, liczby treningów, zadań, wpisów… liczone z danych. */
export default function AchievementsScreen() {
  const db = useSQLiteContext();
  const today = useToday();
  const { colors } = useTheme();
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      const list = achievementList(await loadAchievementStats(db, today));
      const seen = parseSeen(await getSetting(db, 'achievements_seen'));
      const unlocked = list.filter((item) => item.unlocked).map((item) => item.id);
      if (!active) return;
      setAchievements(list);
      // „Nowe” zostają oznaczone do końca tej wizyty; zapisujemy je od razu jako widziane.
      setFresh(new Set(unlocked.filter((id) => !seen.has(id))));
      await setSetting(db, 'achievements_seen', JSON.stringify([...new Set([...seen, ...unlocked])]));
    })();
    return () => {
      active = false;
    };
  }, [db, today]);

  const unlockedCount = achievements?.filter((item) => item.unlocked).length ?? 0;
  const categories = achievements ? [...new Set(achievements.map((item) => item.category))] : [];

  return (
    <ScrollScreen title="Osiągnięcia">
      {achievements ? (
        <>
          <Card style={styles.summary}>
            <AppText variant="heading">
              🏅 {unlockedCount} z {achievements.length}
            </AppText>
            <Meter value={unlockedCount / achievements.length} color={colors.accent} />
            <AppText variant="caption" tone="textSecondary">
              {fresh.size
                ? `Nowe od ostatniej wizyty: ${fresh.size}. Tak trzymaj!`
                : 'Odznaki zdobywasz za regularność — nawyki, treningi, zadania, dziennik i sen.'}
            </AppText>
          </Card>
          {categories.map((category) => (
            <Section key={category} title={category}>
              <View style={styles.grid}>
                {achievements
                  .filter((item) => item.category === category)
                  .map((item) => (
                    <Badge key={item.id} achievement={item} fresh={fresh.has(item.id)} />
                  ))}
              </View>
            </Section>
          ))}
        </>
      ) : null}
    </ScrollScreen>
  );
}

function Badge({ achievement, fresh }: { achievement: Achievement; fresh: boolean }) {
  const { colors } = useTheme();
  const { unlocked } = achievement;

  return (
    <View
      accessibilityLabel={`${achievement.title}: ${unlocked ? 'zdobyte' : `${Math.floor(achievement.progress)} z ${achievement.target}`}. ${achievement.description}`}
      style={[
        styles.badge,
        { backgroundColor: unlocked ? colors.accentSoft : colors.surface, borderColor: fresh ? colors.accent : 'transparent' },
      ]}>
      <View style={styles.badgeHeader}>
        <Text style={[styles.emoji, !unlocked && styles.locked]}>{achievement.icon}</Text>
        {fresh ? (
          <View style={[styles.newPill, { backgroundColor: colors.accent }]}>
            <AppText variant="caption" style={[styles.newText, { color: colors.onAccent }]}>
              NOWE
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="bodyStrong" tone={unlocked ? 'text' : 'textSecondary'} numberOfLines={2}>
        {achievement.title}
      </AppText>
      <AppText variant="caption" tone="textMuted" numberOfLines={3}>
        {achievement.description}
      </AppText>
      {unlocked ? null : (
        <View style={styles.progress}>
          <Meter value={achievement.progress / achievement.target} color={colors.accent} />
          <AppText variant="caption" tone="textSecondary">
            {Math.floor(achievement.progress)} / {achievement.target}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    flexBasis: '48%',
    flexGrow: 1,
    maxWidth: '50%',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  badgeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emoji: { fontSize: 28 },
  locked: { opacity: 0.3 },
  newPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  newText: { fontWeight: '700' },
  progress: { gap: 2, marginTop: spacing.xs },
});
