import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', icon, disabled }: Props) {
  const { colors } = useTheme();
  const background = variant === 'primary' ? colors.accent : colors.surfaceAlt;
  const foreground =
    variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.danger : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: colors.border }}
      style={[styles.button, { backgroundColor: background, opacity: disabled ? 0.5 : 1 }]}>
      {icon ? <Icon name={icon} size={20} color={foreground} /> : null}
      <AppText variant="bodyStrong" style={{ color: foreground }}>
        {label}
      </AppText>
    </Pressable>
  );
}

type IconButtonProps = {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'filled' | 'plain';
  color?: string;
};

export function IconButton({ icon, onPress, accessibilityLabel, variant = 'plain', color }: IconButtonProps) {
  const { colors } = useTheme();
  const filled = variant === 'filled';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      android_ripple={{ color: colors.border, borderless: !filled }}
      style={[styles.iconButton, filled && { backgroundColor: colors.accent }]}>
      <Icon name={icon} color={color ?? (filled ? colors.onAccent : colors.text)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
