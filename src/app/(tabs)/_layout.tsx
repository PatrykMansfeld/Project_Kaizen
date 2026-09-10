import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/theme/use-theme';

// Android pozwala na maksymalnie 5 zakładek — dziennik jest częścią „Dziś”.
export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      indicatorColor={colors.accentSoft}
      rippleColor={colors.accentSoft}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.accent } }}
      labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon md="today" />
        <NativeTabs.Trigger.Label>Dziś</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="nawyki">
        <NativeTabs.Trigger.Icon md="check_circle" />
        <NativeTabs.Trigger.Label>Nawyki</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="zadania">
        <NativeTabs.Trigger.Icon md="checklist" />
        <NativeTabs.Trigger.Label>Zadania</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="aktywnosc">
        <NativeTabs.Trigger.Icon md="directions_run" />
        <NativeTabs.Trigger.Label>Aktywność</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notatki">
        <NativeTabs.Trigger.Icon md="sticky_note_2" />
        <NativeTabs.Trigger.Label>Notatki</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
