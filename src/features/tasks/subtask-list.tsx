import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { IconButton } from '@/components/button';
import { CheckCircle } from '@/components/check-circle';
import { Icon } from '@/components/icon';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

export type SubtaskDraft = { key: string; title: string; done: boolean };

let lastKey = 0;
export const newSubtaskKey = () => `s${++lastKey}`;

type Props = { items: SubtaskDraft[]; onChange: (items: SubtaskDraft[]) => void };

/** Checklista w zadaniu: odhaczanie, edycja w miejscu, usuwanie i dopisywanie kolejnych kroków. */
export function SubtaskList({ items, onChange }: Props) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');

  const update = (key: string, patch: Partial<SubtaskDraft>) =>
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    onChange([...items, { key: newSubtaskKey(), title, done: false }]);
    setDraft('');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {items.map((item) => (
        <View key={item.key} style={styles.row}>
          <CheckCircle
            checked={item.done}
            onPress={() => update(item.key, { done: !item.done })}
            color={colors.tasks}
            accessibilityLabel={item.done ? `Odznacz: ${item.title}` : `Odhacz: ${item.title}`}
          />
          <TextInput
            value={item.title}
            onChangeText={(title) => update(item.key, { title })}
            // Pusty tytuł po edycji = usunięcie kroku.
            onEndEditing={() => !item.title.trim() && onChange(items.filter((other) => other.key !== item.key))}
            cursorColor={colors.accent}
            style={[
              styles.input,
              { color: item.done ? colors.textMuted : colors.text },
              item.done && styles.done,
            ]}
          />
          <IconButton
            icon="close"
            color={colors.textMuted}
            accessibilityLabel={`Usuń: ${item.title}`}
            onPress={() => onChange(items.filter((other) => other.key !== item.key))}
          />
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.addIcon}>
          <Icon name="add" size={20} color={colors.textMuted} />
        </View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Dodaj krok"
          placeholderTextColor={colors.textMuted}
          cursorColor={colors.accent}
          returnKeyType="done"
          // Klawiatura zostaje otwarta — można wpisywać kolejne kroki jeden po drugim.
          submitBehavior="submit"
          onSubmitEditing={add}
          onBlur={add}
          style={[styles.input, { color: colors.text }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  input: { flex: 1, fontSize: 16, paddingVertical: spacing.xs },
  done: { textDecorationLine: 'line-through' },
  addIcon: { width: 26, alignItems: 'center' },
});
