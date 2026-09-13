import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/use-theme';

/** Ozdoby nagłówka zakładek stylów sakura i terminal (bez interakcji, pomijane przez czytnik ekranu). */

const WIDTH = 360;

/** Kwiat wiśni z pięciu płatków. */
function Blossom({ x, y, size, petal, center }: { x: number; y: number; size: number; petal: string; center: string }) {
  return (
    <G x={x} y={y}>
      {[0, 72, 144, 216, 288].map((angle) => (
        <Ellipse key={angle} cx={0} cy={-size * 0.5} rx={size * 0.3} ry={size * 0.45} fill={petal} rotation={angle} origin="0, 0" />
      ))}
      <Circle cx={0} cy={0} r={size * 0.14} fill={center} />
    </G>
  );
}

/** Sakura: kwiat wiśni tuż za tytułem. */
export function SakuraBlossom() {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={24} height={24} viewBox="-12 -12 24 24">
        <Blossom x={0} y={0} size={11} petal={colors.decor} center={colors.decorAlt} />
      </Svg>
    </View>
  );
}

/** Sakura: cienka gałązka z kwiatami i spadającymi płatkami pod nagłówkiem. */
export function SakuraBranch() {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={{ backgroundColor: colors.background }}>
      <Svg width="100%" height={18} viewBox={`0 0 ${WIDTH} 18`} preserveAspectRatio="xMaxYMid slice">
        <Path d="M190 4 C 240 8, 290 5, 360 9" stroke={colors.decorLine} strokeWidth={1.4} fill="none" opacity={0.7} />
        <Path d="M262 6 C 270 10, 276 12, 284 13" stroke={colors.decorLine} strokeWidth={1} fill="none" opacity={0.7} />
        <Blossom x={236} y={7} size={6} petal={colors.decor} center={colors.decorAlt} />
        <Blossom x={286} y={13} size={5} petal={colors.decor} center={colors.decorAlt} />
        <Blossom x={330} y={8} size={6.5} petal={colors.decor} center={colors.decorAlt} />
        <Ellipse cx={150} cy={11} rx={2.6} ry={1.6} fill={colors.decor} rotation={-25} origin="150, 11" opacity={0.8} />
        <Ellipse cx={96} cy={6} rx={2.2} ry={1.4} fill={colors.decor} rotation={30} origin="96, 6" opacity={0.6} />
      </Svg>
    </View>
  );
}

/** Terminal: znak zachęty „>” przed tytułem. */
export function TerminalPrompt() {
  return (
    <AppText variant="title" tone="accent" importantForAccessibility="no" accessibilityElementsHidden>
      {'>'}
    </AppText>
  );
}

/** Terminal: migający kursor za tytułem (bez migania przy ograniczonym ruchu). */
export function TerminalCursor() {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced || cancelled) return;
      const step = (toValue: number) => Animated.timing(opacity, { toValue, duration: 0, delay: 530, useNativeDriver: true });
      animation = Animated.loop(Animated.sequence([step(0), step(1)]));
      animation.start();
    });
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [opacity]);

  return <Animated.View pointerEvents="none" style={[styles.cursor, { backgroundColor: colors.accent, opacity }]} />;
}

/** Terminal: przerywana linia pod nagłówkiem. */
export function TerminalRule() {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={{ backgroundColor: colors.background }}>
      <Svg width="100%" height={6}>
        <Line x1="0" y1="3" x2="100%" y2="3" stroke={colors.decorAlt} strokeWidth={1} strokeDasharray="6 4" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  cursor: { width: 12, height: 24 },
});
