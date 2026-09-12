import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DayNavigator } from '@/components/day-navigator';
import { EmojiScale } from '@/components/emoji-scale';
import { Icon, type IconName } from '@/components/icon';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TimePickerSheet } from '@/components/time-picker-sheet';
import { SLEEP_QUALITY, deleteSleep, getLatestSleep, getSleep, saveSleep, sleepDuration } from '@/db/sleep';
import { isDateKey, type DateKey } from '@/lib/dates';
import { formatDuration } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Sen: /sen/2026-09-10 (dzień pobudki). */
export default function SleepScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const today = useToday();
  const [date, setDate] = useState<DateKey>(isDateKey(params.date) ? params.date : today);

  return (
    <ScrollScreen title="Sen">
      <DayNavigator date={date} today={today} onChange={setDate} maxDate={today} />
      {/* key: zmiana dnia wczytuje formularz od nowa. */}
      <SleepForm key={date} date={date} />
    </ScrollScreen>
  );
}

function SleepForm({ date }: { date: DateKey }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState<number | null>(null);
  const [exists, setExists] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [picker, setPicker] = useState<'bed' | 'wake' | null>(null);

  useEffect(() => {
    Promise.all([getSleep(db, date), getLatestSleep(db)]).then(([entry, latest]) => {
      // Istniejący wpis albo godziny z ostatniej nocy jako podpowiedź.
      const source = entry ?? latest;
      if (source) {
        setBedtime(source.bedtime);
        setWakeTime(source.wake_time);
      }
      if (entry) setQuality(entry.quality);
      setExists(entry !== null);
      setLoaded(true);
    });
  }, [db, date]);

  if (!loaded) return null;

  const save = async () => {
    await saveSleep(db, date, { bedtime, wake_time: wakeTime, quality });
    router.back();
  };

  const remove = async () => {
    await deleteSleep(db, date);
    router.back();
  };

  return (
    <View style={styles.form}>
      <Card style={styles.card}>
        <TimeRow icon="bedtime" label="Zasypianie" value={bedtime} onPress={() => setPicker('bed')} />
        <TimeRow icon="light_mode" label="Pobudka" value={wakeTime} onPress={() => setPicker('wake')} />
        <View style={[styles.total, { borderTopColor: colors.border }]}>
          <AppText tone="textSecondary" style={styles.flex}>
            Długość snu
          </AppText>
          <AppText variant="heading">{formatDuration(sleepDuration(bedtime, wakeTime))}</AppText>
        </View>
      </Card>

      <Section title="Jak się spało?">
        <EmojiScale options={SLEEP_QUALITY} value={quality} onChange={setQuality} color={colors.accent} />
      </Section>

      <Button label={exists ? 'Zapisz zmiany' : 'Zapisz sen'} icon="check" onPress={save} />
      {exists ? <Button label="Usuń wpis" icon="delete" variant="danger" onPress={remove} /> : null}

      <TimePickerSheet
        visible={picker !== null}
        title={picker === 'bed' ? 'Zasypianie' : 'Pobudka'}
        value={picker === 'bed' ? bedtime : wakeTime}
        onChange={(time) => (picker === 'bed' ? setBedtime(time) : setWakeTime(time))}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

function TimeRow({ icon, label, value, onPress }: { icon: IconName; label: string; value: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={styles.timeRow}>
      <Icon name={icon} color={colors.accent} />
      <AppText style={styles.flex}>{label}</AppText>
      <AppText variant="heading" tone="accent">
        {value}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  card: { gap: spacing.sm },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  total: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  flex: { flex: 1 },
});
