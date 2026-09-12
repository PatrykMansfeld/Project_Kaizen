import { useState } from 'react';
import type { KeyboardTypeOptions } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, SheetActions } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';

type Props = {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  keyboardType?: KeyboardTypeOptions;
  onSubmit: (value: string) => void;
  onClose: () => void;
};

/** Okienko z jednym polem tekstowym (np. nazwa szablonu). Android nie ma systemowego Alert.prompt. */
export function PromptSheet({ visible, onClose, ...rest }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <PromptContent onClose={onClose} {...rest} />
    </BottomSheet>
  );
}

function PromptContent({
  title,
  placeholder,
  initialValue = '',
  submitLabel = 'Zapisz',
  keyboardType,
  onSubmit,
  onClose,
}: Omit<Props, 'visible'>) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  };

  return (
    <>
      <AppText variant="heading">{title}</AppText>
      <TextField
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <SheetActions>
        <Button label="Anuluj" variant="secondary" onPress={onClose} />
        <Button label={submitLabel} onPress={submit} disabled={!trimmed} />
      </SheetActions>
    </>
  );
}
