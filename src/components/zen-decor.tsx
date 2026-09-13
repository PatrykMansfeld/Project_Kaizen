import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/use-theme';

/** Czerwona pieczątka 改善 („kaizen”) tuż za tytułem zakładki (styl zen) — ozdoba, pomijana przez czytnik ekranu. */
export function ZenSeal() {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.seal, { backgroundColor: colors.decorAlt }]}>
      <Text style={styles.sealText}>改{'\n'}善</Text>
    </View>
  );
}

/** Pociągnięcie pędzla pod nagłówkiem: cienkie na końcach, grubsze pośrodku. */
export function ZenBrush() {
  const { colors, dark } = useTheme();
  return (
    <View pointerEvents="none" style={{ backgroundColor: colors.background }}>
      <Svg width="100%" height={8} viewBox="0 0 360 8" preserveAspectRatio="none">
        <Path
          d="M16 4.6 C 90 2.2, 220 2.0, 344 3.9 C 250 6.0, 110 6.8, 16 4.6 Z"
          fill={colors.decorLine}
          opacity={dark ? 0.5 : 0.35}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  seal: {
    width: 22,
    height: 30,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
    transform: [{ rotate: '-4deg' }],
  },
  sealText: { color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontWeight: '700', textAlign: 'center' },
});
