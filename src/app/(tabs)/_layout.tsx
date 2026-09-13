import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useModulePreferences } from '@/features/modules/preferences';
import { MODULES, TAB_MODULES } from '@/features/modules/registry';
import { useTheme } from '@/theme/use-theme';

/**
 * Dolny pasek: „Dziś” i do 4 modułów wybranych na ekranie Moduły → Dostosuj (Android pozwala na 5 zakładek).
 * Pozostałe moduły mają ukryte zakładki — otwierają się wtedy przez /modul/[key].
 * Zmiana układu przebudowuje pasek (i wraca do pierwszej zakładki).
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { tabs } = useModulePreferences();
  const order = [...tabs, ...TAB_MODULES.filter((key) => !tabs.includes(key))];

  return (
    <NativeTabs
      backgroundColor={colors.chrome}
      indicatorColor={colors.accentSoft}
      rippleColor={colors.accentSoft}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.accent } }}
      labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon md="today" />
        <NativeTabs.Trigger.Label>Dziś</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {order.map((key) => (
        <NativeTabs.Trigger key={key} name={key} hidden={!tabs.includes(key)}>
          <NativeTabs.Trigger.Icon md={MODULES[key].icon} />
          <NativeTabs.Trigger.Label>{MODULES[key].tabLabel ?? MODULES[key].label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
