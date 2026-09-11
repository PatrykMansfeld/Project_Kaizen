import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { formatDecimal } from '@/lib/format';
import { useTheme } from '@/theme/use-theme';

export type LinePoint = {
  key: string;
  /** Pozycja na osi X, np. numer dnia — odstępy odpowiadają upływowi czasu. */
  x: number;
  y: number;
};

type Props = {
  points: LinePoint[];
  color: string;
  height?: number;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  /** Podpis wartości przy ostatnim punkcie (np. „82,4”). */
  formatValue?: (value: number) => string;
};

const GUTTER = 36; // miejsce na podpisy osi Y
const PAD_TOP = 18;
const PAD_BOTTOM = 8;
const PAD_RIGHT = 12;

/** „Ładny” krok osi: 1, 2, 2,5 albo 5 × 10ⁿ. */
function niceStep(rough: number) {
  const power = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((step) => step >= rough) ?? power * 10;
}

/**
 * Wykres liniowy jednej serii (trend w czasie): linia 2 px, punkty 8 px z obwódką w kolorze tła,
 * delikatna siatka z zaokrąglonymi podziałkami, podpis tylko przy ostatnim punkcie.
 * Stuknięcie wybiera najbliższy punkt w poziomie.
 */
export function LineChart({ points, color, height = 160, selectedKey = null, onSelect, formatValue }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const values = points.map((point) => point.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || Math.max(Math.abs(max) * 0.05, 1);
  const step = niceStep(spread / 3);
  const yMin = Math.floor((min - spread * 0.1) / step) * step;
  const yMax = Math.ceil((max + spread * 0.1) / step) * step;
  const ticks: number[] = [];
  for (let tick = yMin; tick <= yMax + step / 2; tick += step) ticks.push(Number(tick.toFixed(6)));

  const xs = points.map((point) => point.x);
  const xMin = Math.min(...xs);
  const xSpan = Math.max(...xs) - xMin;
  const plotWidth = Math.max(width - GUTTER - PAD_RIGHT, 1);
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;
  const px = (x: number) => GUTTER + (xSpan === 0 ? plotWidth / 2 : ((x - xMin) / xSpan) * plotWidth);
  const py = (y: number) => PAD_TOP + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;

  const selectNearest = (locationX: number) => {
    if (!onSelect || points.length === 0) return;
    const nearest = points.reduce((best, point) =>
      Math.abs(px(point.x) - locationX) < Math.abs(px(best.x) - locationX) ? point : best,
    );
    onSelect(nearest.key);
  };

  const last = points[points.length - 1];
  const format = formatValue ?? ((value: number) => formatDecimal(value, 1));

  return (
    <View style={{ height }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && points.length > 0 ? (
        <Svg width={width} height={height}>
          {ticks.map((tick) => (
            <Line key={`g${tick}`} x1={GUTTER} x2={width - PAD_RIGHT} y1={py(tick)} y2={py(tick)} stroke={colors.border} strokeWidth={StyleSheet.hairlineWidth} />
          ))}
          {ticks.map((tick) => (
            <SvgText key={`t${tick}`} x={GUTTER - 6} y={py(tick) + 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
              {formatDecimal(tick, 1)}
            </SvgText>
          ))}
          {points.length > 1 ? (
            <Polyline
              points={points.map((point) => `${px(point.x)},${py(point.y)}`).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {points.map((point) => {
            const selected = point.key === selectedKey;
            return (
              <Circle
                key={point.key}
                cx={px(point.x)}
                cy={py(point.y)}
                r={selected ? 6 : 4}
                fill={color}
                stroke={colors.surface}
                strokeWidth={2}
              />
            );
          })}
          <SvgText
            x={Math.min(px(last.x), width - PAD_RIGHT)}
            y={py(last.y) - 10}
            fontSize={12}
            fontWeight="600"
            fill={colors.text}
            textAnchor={px(last.x) > width - 40 ? 'end' : 'middle'}>
            {format(last.y)}
          </SvgText>
        </Svg>
      ) : null}
      {onSelect ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={(event) => selectNearest(event.nativeEvent.locationX)}
          accessibilityLabel="Wykres: stuknij, żeby zobaczyć pomiar"
        />
      ) : null}
    </View>
  );
}
