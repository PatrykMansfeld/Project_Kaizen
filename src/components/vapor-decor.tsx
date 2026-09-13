import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/use-theme';

const SUN_WIDTH = 150;
const SUN_HEIGHT = 92;
/** Poziome „cięcia” słońca (od dołu): wysokość paska i odstęp od dolnej krawędzi. */
const SUN_CUTS = [
  { y: 6, h: 5 },
  { y: 18, h: 4 },
  { y: 29, h: 3 },
  { y: 39, h: 2 },
];

/** Zachodzące słońce w paski — tło nagłówka w stylu vaporwave (bez interakcji, pod treścią). */
export function VaporSun() {
  const { colors, dark } = useTheme();
  return (
    <View pointerEvents="none" style={styles.sun}>
      <Svg width={SUN_WIDTH} height={SUN_HEIGHT} opacity={dark ? 0.75 : 0.9}>
        <Defs>
          <LinearGradient id="vaporSun" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.decor} />
            <Stop offset="1" stopColor={colors.decorAlt} />
          </LinearGradient>
        </Defs>
        <Circle cx={SUN_WIDTH / 2} cy={SUN_HEIGHT + 8} r={62} fill="url(#vaporSun)" />
        {SUN_CUTS.map((cut) => (
          <Rect key={cut.y} x={0} y={SUN_HEIGHT - cut.y - cut.h} width={SUN_WIDTH} height={cut.h} fill={colors.chrome} />
        ))}
      </Svg>
    </View>
  );
}

const GRID_WIDTH = 360;
const GRID_HEIGHT = 22;

/** Siatka w perspektywie pod nagłówkiem („podłoga” retro), rozciągnięta na całą szerokość. */
export function VaporGrid() {
  const { colors } = useTheme();
  const center = GRID_WIDTH / 2;
  const rays = [-3, -2, -1, 0, 1, 2, 3].map((index) => ({ top: center + index * 40, bottom: center + index * 150 }));
  return (
    <View pointerEvents="none" style={{ backgroundColor: colors.background }}>
      <Svg width="100%" height={GRID_HEIGHT} viewBox={`0 0 ${GRID_WIDTH} ${GRID_HEIGHT}`} preserveAspectRatio="none">
        {[1, 7, 15].map((y) => (
          <Line key={`h${y}`} x1={0} y1={y} x2={GRID_WIDTH} y2={y} stroke={colors.decorLine} strokeWidth={1} opacity={0.8} />
        ))}
        {rays.map((ray) => (
          <Line key={`v${ray.top}`} x1={ray.top} y1={1} x2={ray.bottom} y2={GRID_HEIGHT} stroke={colors.decorLine} strokeWidth={1} opacity={0.8} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  sun: { position: 'absolute', right: 56, bottom: 0 },
});
