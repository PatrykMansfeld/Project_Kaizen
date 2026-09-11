import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/**
 * Blokada aplikacji. PIN nigdy nie jest zapisywany wprost — w bezpiecznym magazynie telefonu
 * (SecureStore) leży tylko skrót SHA-256 z losową solą. Ustawienia blokady nie trafiają do kopii
 * zapasowej ani do bazy, więc import danych jej nie wyłączy.
 */

const KEYS = {
  hash: 'kaizen_lock_hash',
  salt: 'kaizen_lock_salt',
  length: 'kaizen_lock_length',
  biometric: 'kaizen_lock_biometric',
};

export const PIN_MIN = 4;
export const PIN_MAX = 6;

/** Po tylu sekundach w tle aplikacja blokuje się ponownie. */
export const LOCK_GRACE_SECONDS = 30;

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function digest(salt: string, pin: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function isLockEnabled() {
  return (await SecureStore.getItemAsync(KEYS.hash)) !== null;
}

/** Długość PIN-u — ekran blokady sprawdza PIN od razu po wpisaniu ostatniej cyfry. */
export async function getPinLength() {
  return Number(await SecureStore.getItemAsync(KEYS.length)) || PIN_MAX;
}

export async function setPin(pin: string) {
  const salt = toHex(Crypto.getRandomBytes(16));
  await SecureStore.setItemAsync(KEYS.salt, salt);
  await SecureStore.setItemAsync(KEYS.hash, await digest(salt, pin));
  await SecureStore.setItemAsync(KEYS.length, String(pin.length));
}

export async function verifyPin(pin: string) {
  const [salt, hash] = await Promise.all([SecureStore.getItemAsync(KEYS.salt), SecureStore.getItemAsync(KEYS.hash)]);
  if (!salt || !hash) return false;
  return (await digest(salt, pin)) === hash;
}

export async function disableLock() {
  await Promise.all(Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key)));
}

export async function isBiometricEnabled() {
  return (await SecureStore.getItemAsync(KEYS.biometric)) === '1';
}

export function setBiometricEnabled(enabled: boolean) {
  return SecureStore.setItemAsync(KEYS.biometric, enabled ? '1' : '0');
}

/** Czy telefon ma czytnik i zapisany odcisk palca / twarz. */
export async function isBiometricAvailable() {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

/** Odblokowanie biometrią (bez awaryjnego kodu telefonu). */
export async function authenticateWithBiometrics() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Odblokuj Kaizen',
    cancelLabel: 'Użyj PIN-u',
    disableDeviceFallback: true,
  });
  return result.success;
}

/** Awaryjnie, gdy zapomnisz PIN-u: blokada ekranu telefonu (PIN, wzór albo odcisk). */
export async function authenticateWithDevice() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Potwierdź, że to Ty',
    disableDeviceFallback: false,
  });
  return result.success;
}
