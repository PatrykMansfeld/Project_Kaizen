import { router } from 'expo-router';
import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { syncGoalAchievements } from '@/db/goals';
import type { Attribute } from '@/db/habits';
import { getSetting, setSetting } from '@/db/settings';
import { XP_TABLES, loadXpData } from '@/db/xp';
import { useModuleVisible } from '@/features/modules/preferences';
import { useToday } from '@/lib/use-today';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { ATTRIBUTES, ATTRIBUTE_KEYS, computeXp, summarizeXp, xpGain, type XpSummary } from './xp';

const XpContext = createContext<XpSummary | null>(null);

/** Podsumowanie punktów (null — jeszcze liczymy albo moduł Postęp jest ukryty). */
export function useXp() {
  return useContext(XpContext);
}

type Toast = { id: number; xp: number; attribute: Attribute };
type Celebration = { kind: 'welcome' | 'level'; summary: XpSummary };

/**
 * Liczy punkty z historii i przelicza je po każdej zmianie w bazie. Pokazuje „+10 XP” po zdobyciu punktów
 * i gratulacje przy nowym najwyższym poziomie (odznaczenie i ponowne zaznaczenie ich nie powtarza).
 */
export function XpProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const today = useToday();
  const visible = useModuleVisible('postep');
  const [summary, setSummary] = useState<XpSummary | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const previous = useRef<XpSummary | null>(null);

  useEffect(() => {
    if (!visible) {
      previous.current = null;
      setSummary(null);
      return;
    }
    let active = true;
    let running = false;
    let again = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        await syncGoalAchievements(db, today);
        if (!active) return;
        const next = summarizeXp(computeXp(await loadXpData(db), today), today);
        if (!active) return;
        const before = previous.current;
        previous.current = next;
        setSummary(next);

        const gain = before ? xpGain(before, next) : null;
        if (gain) setToast((current) => ({ id: (current?.id ?? 0) + 1, ...gain }));

        const best = Number(await getSetting(db, 'xp_max_level')) || 0;
        if (!active) return;
        if (best === 0) {
          await setSetting(db, 'xp_max_level', String(next.level.level));
          setCelebration({ kind: 'welcome', summary: next });
        } else if (next.level.level > best) {
          await setSetting(db, 'xp_max_level', String(next.level.level));
          setCelebration({ kind: 'level', summary: next });
        }
      } catch (error) {
        // Po odmontowaniu (np. Fast Refresh, przeładowanie) baza bywa już zamknięta — przerwane liczenie nie jest błędem.
        if (active) console.error('Postęp:', error);
      } finally {
        running = false;
        if (again && active) {
          again = false;
          void run();
        }
      }
    };

    void run();
    const subscription = addDatabaseChangeListener((event) => {
      if (!XP_TABLES.has(event.tableName)) return;
      // Seria zmian (np. zapis treningu z seriami) daje jedno przeliczenie.
      clearTimeout(timer);
      timer = setTimeout(() => void run(), 250);
    });

    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [db, today, visible]);

  return (
    <XpContext.Provider value={summary}>
      <View style={styles.root}>
        {children}
        {visible && toast ? <XpToast key={toast.id} toast={toast} /> : null}
        {visible && celebration ? <CelebrationCard celebration={celebration} onClose={() => setCelebration(null)} /> : null}
      </View>
    </XpContext.Provider>
  );
}

/** Dyskretny napis „+10 XP · Ciało” nad dolnym paskiem; znika sam po chwili. */
function XpToast({ toast }: { toast: Toast }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  const attribute = ATTRIBUTES[toast.attribute];
  const text = `+${toast.xp} XP · ${attribute.label}`;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(text);
    const animation = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, text]);

  const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toastWrap, { bottom: insets.bottom + 96, opacity, transform: [{ translateY }] }]}>
      <View style={[styles.toast, { backgroundColor: colors.text }]}>
        <View style={[styles.toastDot, { backgroundColor: colors[attribute.color] }]} />
        <AppText variant="bodyStrong" style={{ color: colors.background }}>
          {text}
        </AppText>
      </View>
    </Animated.View>
  );
}

/**
 * Gratulacje nowego poziomu albo powitanie przy pierwszym uruchomieniu. Nakładka w drzewie (nie Modal),
 * żeby blokada aplikacji zawsze była nad nią.
 */
function CelebrationCard({ celebration, onClose }: { celebration: Celebration; onClose: () => void }) {
  const { colors } = useTheme();
  const { kind, summary } = celebration;
  const level = summary.level.level;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  const open = (path: '/postep' | '/cechy-nawykow') => {
    onClose();
    router.push(path);
  };

  const fresh = kind === 'welcome' && summary.total === 0;
  const title = kind === 'level' ? `Poziom ${level}!` : fresh ? 'Nowość: Postęp' : `Zaczynasz od poziomu ${level}`;
  const body =
    kind === 'level'
      ? 'Kolejny mały krok. Tak właśnie działa kaizen.'
      : fresh
        ? 'Za nawyki, treningi, zadania, wpisy i resztę modułów zbierasz punkty, a z nimi kolejne poziomy.'
        : `${summary.total} XP policzyłem z tego, co już zapisałeś. Cechy nawyków dobrałem po ikonach — sprawdź, czy pasują.`;

  return (
    <View style={styles.overlay}>
      <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} accessibilityLabel="Zamknij" />
      <View style={[styles.card, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
        <AppText style={styles.emoji}>{kind === 'level' ? '🎉' : '🌱'}</AppText>
        <AppText variant="title" style={styles.center}>
          {title}
        </AppText>
        <AppText tone="textSecondary" style={styles.center}>
          {body}
        </AppText>
        {fresh ? null : (
          <View style={styles.attributes}>
            {ATTRIBUTE_KEYS.map((key) => (
              <View key={key} style={styles.attribute}>
                <View style={[styles.toastDot, { backgroundColor: colors[ATTRIBUTES[key].color] }]} />
                <AppText variant="caption" tone="textSecondary">
                  {ATTRIBUTES[key].label} {summary.attributes[key].level.level}
                </AppText>
              </View>
            ))}
          </View>
        )}
        <View style={styles.actions}>
          {kind === 'welcome' && !fresh ? (
            <Button label="Sprawdź cechy nawyków" variant="secondary" onPress={() => open('/cechy-nawykow')} />
          ) : (
            <Button label="Zobacz postęp" variant="secondary" onPress={() => open('/postep')} />
          )}
          <Button label="Super" onPress={onClose} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  toastDot: { width: 8, height: 8, borderRadius: radius.full },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', padding: spacing.xl },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  card: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, alignItems: 'stretch' },
  emoji: { fontSize: 48, lineHeight: 60, textAlign: 'center' },
  center: { textAlign: 'center' },
  attributes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  attribute: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
