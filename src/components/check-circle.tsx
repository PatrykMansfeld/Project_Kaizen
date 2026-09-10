import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { radius } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  checked: boolean;
  onPress: () => void;
  color?: string;
  accessibilityLabel: string;
};

export function CheckCircle({ checked, onPress, color, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const tint = color ?? colors.accent;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.circle,
        checked ? { backgroundColor: tint, borderColor: tint } : { borderColor: colors.textMuted },
      ]}>
      {checked ? <Icon name="check" size={16} color={colors.onAccent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
