import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { CheckCircle } from '@/components/check-circle';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { parseInline, parseMarkdown } from './markdown';

function InlineText({ text, style }: { text: string; style?: object }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.text, { color: colors.text }, style]}>
      {parseInline(text).map((part, index) => (
        <Text key={index} style={[part.bold && styles.bold, part.italic && styles.italic]}>
          {part.text}
        </Text>
      ))}
    </Text>
  );
}

type Props = {
  body: string;
  /** Stuknięcie w zadanie z checklisty — numer linii w tekście. */
  onToggleCheck: (line: number) => void;
  /** Stuknięcie w zwykły tekst — np. przejście do edycji. */
  onPressText?: () => void;
};

/** Podgląd sformatowanej notatki z klikalnymi checklistami. */
export function MarkdownView({ body, onToggleCheck, onPressText }: Props) {
  const { colors } = useTheme();
  const blocks = parseMarkdown(body);

  if (!body.trim()) {
    return (
      <Pressable onPress={onPressText}>
        <AppText tone="textMuted">Pusta notatka — stuknij, żeby pisać.</AppText>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPressText} style={styles.container}>
      {blocks.map((block) => {
        switch (block.kind) {
          case 'space':
            return <View key={block.line} style={styles.space} />;
          case 'heading':
            return <InlineText key={block.line} text={block.text} style={block.level === 1 ? styles.h1 : styles.h2} />;
          case 'check':
            return (
              <View key={block.line} style={styles.row}>
                <CheckCircle
                  checked={block.done}
                  onPress={() => onToggleCheck(block.line)}
                  color={colors.notes}
                  accessibilityLabel={block.done ? `Odznacz: ${block.text}` : `Odhacz: ${block.text}`}
                />
                <InlineText
                  text={block.text}
                  style={[styles.flex, block.done && { color: colors.textMuted, textDecorationLine: 'line-through' }]}
                />
              </View>
            );
          case 'bullet':
            return (
              <View key={block.line} style={styles.row}>
                <Text style={[styles.bullet, { color: colors.textSecondary }]}>•</Text>
                <InlineText text={block.text} style={styles.flex} />
              </View>
            );
          default:
            return <InlineText key={block.line} text={block.text} />;
        }
      })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs, paddingTop: spacing.md },
  text: { fontSize: 16, lineHeight: 24 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  h1: { fontSize: 22, lineHeight: 28, fontWeight: '700', marginTop: spacing.sm },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '700', marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 2 },
  bullet: { fontSize: 16, lineHeight: 24, width: 26, textAlign: 'center' },
  flex: { flex: 1 },
  space: { height: spacing.sm },
});
