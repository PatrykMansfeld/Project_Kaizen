import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { spacing } from '@/theme/theme';

import {
  LOCK_GRACE_SECONDS,
  PIN_MAX,
  PIN_MIN,
  disableLock,
  getPinLength,
  isBiometricAvailable,
  isBiometricEnabled,
  isLockEnabled,
  setBiometricEnabled,
  setPin,
  verifyPin,
} from './lock';
import { PinPad } from './pin-pad';

type Flow = 'setup' | 'change' | 'disable';

/** Sekcja „Blokada aplikacji” w Ustawieniach. */
export function LockSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [biometric, setBiometric] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);

  const refresh = async () => {
    setEnabled(await isLockEnabled());
    setBiometric(await isBiometricEnabled());
    setBiometricAvailable(await isBiometricAvailable());
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (enabled === null) return null;

  return (
    <View style={styles.container}>
      {enabled ? (
        <>
          <AppText tone="textSecondary">
            Blokada jest włączona. Aplikacja zablokuje się przy starcie i po {LOCK_GRACE_SECONDS} s w tle.
          </AppText>
          {biometricAvailable ? (
            <ChipRow>
              <Chip
                label="Odblokowanie odciskiem palca"
                icon="fingerprint"
                selected={biometric}
                onPress={async () => {
                  await setBiometricEnabled(!biometric);
                  setBiometric(!biometric);
                }}
              />
            </ChipRow>
          ) : null}
          <Button label="Zmień PIN" icon="lock" variant="secondary" onPress={() => setFlow('change')} />
          <Button label="Wyłącz blokadę" icon="lock_open" variant="danger" onPress={() => setFlow('disable')} />
        </>
      ) : (
        <>
          <AppText tone="textSecondary">
            Chroń dziennik i notatki PIN-em{biometricAvailable ? ' albo odciskiem palca' : ''}. Aplikacja zablokuje się
            przy starcie i po {LOCK_GRACE_SECONDS} s w tle.
          </AppText>
          <Button label="Włącz blokadę" icon="lock" onPress={() => setFlow('setup')} />
        </>
      )}

      <PinFlowSheet
        flow={flow}
        onClose={() => setFlow(null)}
        onDone={async () => {
          setFlow(null);
          await refresh();
        }}
      />
    </View>
  );
}

type Step = 'verify' | 'new' | 'confirm';

function PinFlowSheet({ flow, onClose, onDone }: { flow: Flow | null; onClose: () => void; onDone: () => void }) {
  return (
    <BottomSheet visible={flow !== null} onClose={onClose}>
      {flow ? <PinFlow flow={flow} onClose={onClose} onDone={onDone} /> : null}
    </BottomSheet>
  );
}

/** Ustawienie, zmiana albo wyłączenie PIN-u — z potwierdzeniem obecnego PIN-u, gdzie trzeba. */
function PinFlow({ flow, onClose, onDone }: { flow: Flow; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<Step>(flow === 'setup' ? 'new' : 'verify');
  const [pin, setPinValue] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [storedLength, setStoredLength] = useState(PIN_MAX);

  useEffect(() => {
    if (flow !== 'setup') getPinLength().then(setStoredLength);
  }, [flow]);

  const titles: Record<Step, string> = {
    verify: 'Wpisz obecny PIN',
    new: `Nowy PIN (${PIN_MIN}–${PIN_MAX} cyfr)`,
    confirm: 'Powtórz nowy PIN',
  };
  const length = step === 'verify' ? storedLength : step === 'confirm' ? first.length : PIN_MAX;

  const finishNew = () => {
    setFirst(pin);
    setPinValue('');
    setStep('confirm');
  };

  const change = async (value: string) => {
    setError(null);
    setPinValue(value);
    if (value.length < length) return;

    if (step === 'verify') {
      if (!(await verifyPin(value))) {
        setError('Błędny PIN');
        setPinValue('');
        return;
      }
      if (flow === 'disable') {
        await disableLock();
        onDone();
        return;
      }
      setPinValue('');
      setStep('new');
    } else if (step === 'new') {
      // Maksymalna długość — od razu dalej.
      setFirst(value);
      setPinValue('');
      setStep('confirm');
    } else {
      if (value !== first) {
        setError('PIN-y się różnią — spróbuj jeszcze raz');
        setPinValue('');
        setFirst('');
        setStep('new');
        return;
      }
      await setPin(value);
      onDone();
    }
  };

  return (
    <>
      <AppText variant="heading" style={styles.center}>
        {titles[step]}
      </AppText>
      <PinPad value={pin} onChange={change} length={length} error={error} />
      <SheetActions>
        <Button label="Anuluj" variant="secondary" onPress={onClose} />
        {step === 'new' ? <Button label="Dalej" onPress={finishNew} disabled={pin.length < PIN_MIN} /> : null}
      </SheetActions>
    </>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  center: { textAlign: 'center' },
});
