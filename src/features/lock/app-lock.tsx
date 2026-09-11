import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import {
  LOCK_GRACE_SECONDS,
  authenticateWithBiometrics,
  authenticateWithDevice,
  getPinLength,
  isBiometricAvailable,
  isBiometricEnabled,
  isLockEnabled,
  verifyPin,
} from './lock';
import { PinPad } from './pin-pad';

/**
 * Nakładka blokady nad całą aplikacją (Modal jest ponad wszystkimi ekranami).
 * Blokuje przy starcie i po powrocie z tła po dłużej niż LOCK_GRACE_SECONDS.
 */
export function AppLock() {
  const { colors } = useTheme();
  const [state, setState] = useState<'checking' | 'locked' | 'unlocked'>('checking');
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    isLockEnabled().then((enabled) => setState(enabled ? 'locked' : 'unlocked'));
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        backgroundAt.current = Date.now();
      } else if (next === 'active' && backgroundAt.current !== null) {
        const away = Date.now() - backgroundAt.current;
        backgroundAt.current = null;
        if (away > LOCK_GRACE_SECONDS * 1000) {
          isLockEnabled().then((enabled) => enabled && setState('locked'));
        }
      }
    });
    return () => subscription.remove();
  }, []);

  if (state === 'unlocked') return null;

  return (
    <Modal
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      // Przycisk wstecz nie omija blokady.
      onRequestClose={() => {}}>
      {state === 'locked' ? (
        <LockScreen onUnlock={() => setState('unlocked')} />
      ) : (
        // Zanim sprawdzimy ustawienia — pusty ekran, żeby treść nie mignęła.
        <View style={[styles.fill, { backgroundColor: colors.background }]} />
      )}
    </Modal>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [length, setLength] = useState(4);
  const [biometric, setBiometric] = useState(false);

  const tryBiometric = async () => {
    if (await authenticateWithBiometrics()) onUnlock();
  };

  useEffect(() => {
    getPinLength().then(setLength);
    Promise.all([isBiometricEnabled(), isBiometricAvailable()]).then(([enabled, available]) => {
      const use = enabled && available;
      setBiometric(use);
      // Odcisk palca od razu po pokazaniu ekranu — PIN zostaje jako zapas.
      if (use) void tryBiometric();
    });
    // Tylko przy pierwszym pokazaniu ekranu blokady.
  }, []);

  const change = async (value: string) => {
    setError(null);
    setPin(value);
    if (value.length < length) return;
    if (await verifyPin(value)) {
      onUnlock();
    } else {
      setError('Błędny PIN');
      setPin('');
    }
  };

  const forgot = async () => {
    if (await authenticateWithDevice()) onUnlock();
  };

  return (
    <View
      style={[
        styles.fill,
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
      ]}>
      <View style={styles.header}>
        <Icon name="lock" size={40} color={colors.accent} />
        <AppText variant="heading">Kaizen</AppText>
        <AppText tone="textSecondary">Wpisz PIN</AppText>
      </View>

      <PinPad
        value={pin}
        onChange={change}
        length={length}
        error={error}
        extra={
          biometric ? (
            <Pressable onPress={tryBiometric} accessibilityRole="button" accessibilityLabel="Odblokuj odciskiem palca" hitSlop={8}>
              <Icon name="fingerprint" size={32} color={colors.accent} />
            </Pressable>
          ) : null
        }
      />

      <Pressable onPress={forgot} accessibilityRole="button" hitSlop={8}>
        <AppText variant="caption" tone="textSecondary">
          Nie pamiętasz PIN-u? Odblokuj blokadą telefonu
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { alignItems: 'center', justifyContent: 'space-between' },
  header: { alignItems: 'center', gap: spacing.sm },
});
