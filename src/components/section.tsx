import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { spacing } from '@/theme/theme';

type Props = {
  title: string;
  /** Ikona modułu przed tytułem (np. w podsumowaniu dnia i statystykach). */
  icon?: IconName;
  color?: string;
  /** Tekst po prawej, np. licznik „2 z 5”. */
  meta?: string;
  /** Przycisk „+” po prawej. */
  onAdd?: () => void;
  /** Dowolny element po prawej (np. link „Szablony ›”). */
  action?: ReactNode;
  children: ReactNode;
};

/** Sekcja ekranu: podpis wersalikami (opcjonalnie z ikoną, licznikiem i „+”) i zawartość pod spodem. */
export function Section({ title, icon, color, meta, onAdd, action, children }: Props) {
  const hasHeaderExtras = icon || meta || onAdd || action;

  return (
    <View style={styles.section}>
      {hasHeaderExtras ? (
        <View style={[styles.header, icon && styles.iconHeader]}>
          {icon ? <Icon name={icon} size={18} color={color} /> : null}
          <AppText variant="label" tone="textSecondary" style={styles.flex}>
            {title}
          </AppText>
          {meta ? (
            <AppText variant="caption" tone="textSecondary">
              {meta}
            </AppText>
          ) : null}
          {action}
          {onAdd ? <IconButton icon="add" accessibilityLabel={`Dodaj: ${title.toLowerCase()}`} onPress={onAdd} /> : null}
        </View>
      ) : (
        <AppText variant="label" tone="textSecondary">
          {title}
        </AppText>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconHeader: { minHeight: 32 },
  flex: { flex: 1 },
});
