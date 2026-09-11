import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
};

/** Okienko z jednym polem tekstowym (np. nazwa szablonu). Android nie ma systemowego Alert.prompt. */
export function PromptSheet({ visible, onClose, ...rest }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <PromptContent onClose={onClose} {...rest} />
    </Modal>
  );
}

function PromptContent({ title, placeholder, initialValue = '', submitLabel = 'Zapisz', onSubmit, onClose }: Omit<Props, 'visible'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  };

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Zamknij" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
        <AppText variant="heading">{title}</AppText>
        <TextField value={value} onChangeText={setValue} placeholder={placeholder} autoFocus returnKeyType="done" onSubmitEditing={submit} />
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button label="Anuluj" variant="secondary" onPress={onClose} />
          </View>
          <View style={styles.flex}>
            <Button label={submitLabel} onPress={submit} disabled={!trimmed} />
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  actions: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
