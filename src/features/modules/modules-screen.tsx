import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextLink } from '@/components/text-link';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

import { useModulePreferences, useOpenModule } from './preferences';
import { MODULES, MODULE_GROUPS, type ModuleInfo } from './registry';

/** Wszystkie moduły w jednym miejscu, pogrupowane; ukryte na końcu. */
export function ModulesScreen() {
  const { hidden, tabs } = useModulePreferences();
  const [showHidden, setShowHidden] = useState(false);
  const all = Object.values(MODULES).filter((module) => module.key !== 'moduly');
  const visible = all.filter((module) => !hidden.includes(module.key));
  const hiddenModules = all.filter((module) => hidden.includes(module.key));

  return (
    <ScrollScreen
      title="Moduły"
      headerRight={<IconButton icon="tune" accessibilityLabel="Dostosuj moduły i zakładki" onPress={() => router.push('/moduly/dostosuj')} />}>
      {MODULE_GROUPS.map((group) => {
        const items = visible.filter((module) => module.group === group);
        if (items.length === 0) return null;
        return (
          <Section key={group} title={group}>
            <View style={styles.grid}>
              {items.map((module) => (
                <ModuleTile key={module.key} module={module} onTabBar={(tabs as string[]).includes(module.key) || module.key === 'dzis'} />
              ))}
            </View>
          </Section>
        );
      })}

      {hiddenModules.length > 0 ? (
        <Section
          title={`Ukryte (${hiddenModules.length})`}
          action={
            <TextLink label={showHidden ? 'Zwiń' : 'Pokaż'} onPress={() => setShowHidden(!showHidden)} />
          }>
          {showHidden ? (
            <View style={styles.grid}>
              {hiddenModules.map((module) => (
                <ModuleTile key={module.key} module={module} dimmed />
              ))}
            </View>
          ) : null}
        </Section>
      ) : null}

      <AppText variant="caption" tone="textMuted">
        Ikoną ⚙ w nagłówku wybierzesz, które moduły są na dolnym pasku, i ukryjesz te, których nie używasz.
      </AppText>
    </ScrollScreen>
  );
}

function ModuleTile({ module, onTabBar = false, dimmed = false }: { module: ModuleInfo; onTabBar?: boolean; dimmed?: boolean }) {
  const { colors } = useTheme();
  const open = useOpenModule();

  return (
    <Card onPress={() => open(module.key)} style={[styles.tile, dimmed && styles.dimmed]} accessibilityLabel={module.label}>
      <View style={styles.tileHeader}>
        <Icon name={module.icon} size={26} color={colors[module.color]} />
        {onTabBar ? <View style={[styles.dot, { backgroundColor: colors.accent }]} accessibilityLabel="Na pasku zakładek" /> : null}
      </View>
      <AppText variant="bodyStrong" numberOfLines={1}>
        {module.label}
      </AppText>
      <AppText variant="caption" tone="textMuted" numberOfLines={2}>
        {module.description}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1, maxWidth: '50%', gap: spacing.xs, padding: spacing.md },
  tileHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dimmed: { opacity: 0.55 },
});
