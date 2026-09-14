import { Pressable } from 'react-native';

import { AppText } from '@/components/app-text';

type Props = { label: string; onPress: () => void; accessibilityLabel?: string };

/** Link tekstowy („Pokaż wszystkie”, „Szablony ›”): mały napis w kolorze akcentu z powiększonym polem dotyku. */
export function TextLink({ label, onPress, accessibilityLabel }: Props) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <AppText variant="caption" tone="accent">
        {label}
      </AppText>
    </Pressable>
  );
}

/** „Pokaż wszystkie (12)” ↔ „Pokaż mniej” pod skróconą listą. */
export function ShowAllLink({ expanded, total, onPress }: { expanded: boolean; total: number; onPress: () => void }) {
  return <TextLink label={expanded ? 'Pokaż mniej' : `Pokaż wszystkie (${total})`} onPress={onPress} />;
}
