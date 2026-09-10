import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/app-text';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = TextInputProps & { label?: string };

export function TextField({ label, style, multiline, ...rest }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="label" tone="textSecondary">
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        cursorColor={colors.accent}
        selectionColor={colors.accentSoft}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.multiline,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  multiline: { minHeight: 110 },
});
