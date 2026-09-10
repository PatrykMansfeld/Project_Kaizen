import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  icon: IconName;
  title: string;
  description?: string;
  color?: string;
};

export function EmptyState({ icon, title, description, color }: Props) {
  const { colors } = useTheme();
  const tint = color ?? colors.accent;

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
        <Icon name={icon} size={32} color={tint} />
      </View>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {description ? (
        <AppText tone="textSecondary" style={styles.center}>
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  center: { textAlign: 'center' },
});
