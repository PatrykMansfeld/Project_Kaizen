import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { radius, withAlpha } from '@/theme/theme';

/** Okrągła plakietka z ikoną na tle w odcieniu jej koloru (np. rodzaj treningu, rodzaj celu). */
export function IconBadge({ icon, color, size = 44 }: { icon: IconName; color: string; size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, backgroundColor: withAlpha(color, 0.16) }]}>
      <Icon name={icon} size={Math.round(size * 0.55)} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
