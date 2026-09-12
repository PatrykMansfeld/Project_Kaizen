import { StyleSheet, Text, View } from 'react-native';

import { radius, withAlpha } from '@/theme/theme';

/** Emoji w kółku w odcieniu koloru (ikona nawyku, kategorii wydatków). */
export function EmojiBadge({ emoji, color, size = 44 }: { emoji: string; color: string; size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, backgroundColor: withAlpha(color, 0.18) }]}>
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
