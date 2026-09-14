import { Image, type ImageStyle } from 'expo-image';
import { useState, type ReactNode } from 'react';
import type { StyleProp } from 'react-native';

import { useTheme } from '@/theme/use-theme';

type Props = {
  /** Plik w katalogu aplikacji (zdjęcie, okładka) albo null. */
  uri: string | null;
  style: StyleProp<ImageStyle>;
  /** Co pokazać bez zdjęcia albo gdy pliku już nie ma (np. po przywróceniu kopii na innym telefonie). */
  fallback: ReactNode;
};

/** Zdjęcie zapisane przez aplikację — z zastępczą treścią, gdy go brak. */
export function StoredImage({ uri, style, fallback }: Props) {
  const { colors } = useTheme();
  const [brokenUri, setBrokenUri] = useState<string | null>(null);
  if (!uri || brokenUri === uri) return fallback;
  return (
    <Image
      source={{ uri }}
      style={[{ backgroundColor: colors.surfaceAlt }, style]}
      contentFit="cover"
      onError={() => setBrokenUri(uri)}
      accessibilityIgnoresInvertColors
    />
  );
}
