import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { MonthCalendar } from '@/components/month-calendar';
import { monthOf, type DateKey } from '@/lib/dates';
import { radius, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

type Props = {
  visible: boolean;
  title: string;
  today: DateKey;
  value: DateKey | null;
  onChange: (day: DateKey | null) => void;
  onClose: () => void;
  /** Czy pokazać „Bez daty” (usunięcie daty). */
  clearable?: boolean;
};

/** Wysuwany od dołu wybór daty. Wybranie dnia od razu zamyka okno. */
export function DatePickerSheet({ visible, onClose, ...rest }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      {/* Modal montuje zawartość przy każdym otwarciu, więc kalendarz startuje od wybranego miesiąca. */}
      <SheetContent onClose={onClose} {...rest} />
    </Modal>
  );
}

function SheetContent({ title, today, value, onChange, onClose, clearable = true }: Omit<Props, 'visible'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => monthOf(value ?? today));

  const pick = (day: DateKey | null) => {
    onChange(day);
    onClose();
  };

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Zamknij" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
        <AppText variant="heading">{title}</AppText>
        <MonthCalendar today={today} selected={value} onSelect={pick} month={month} onMonthChange={setMonth} />
        <View style={styles.actions}>
          {clearable ? (
            <View style={styles.action}>
              <Button label="Bez daty" variant="secondary" onPress={() => pick(null)} />
            </View>
          ) : null}
          <View style={styles.action}>
            <Button label="Anuluj" variant="secondary" onPress={onClose} />
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
  action: { flex: 1 },
});
