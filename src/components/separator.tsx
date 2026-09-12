import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/theme';

/** Odstęp między elementami list (ItemSeparatorComponent). */
export function Separator() {
  return <View style={styles.small} />;
}

/** Większy odstęp — między dużymi kartami (np. nawyki). */
export function SeparatorLarge() {
  return <View style={styles.large} />;
}

const styles = StyleSheet.create({
  small: { height: spacing.sm },
  large: { height: spacing.md },
});
