import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { CheckCircle } from '@/components/check-circle';
import { HeaderTextButton } from '@/components/header';
import { Icon } from '@/components/icon';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { useModulePreferences } from '@/features/modules/preferences';
import {
  MAX_EXTRA_TABS,
  MODULES,
  TAB_MODULES,
  isTabModule,
  type ModuleKey,
  type TabModuleKey,
} from '@/features/modules/registry';
import { spacing } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';

/** Dostosowanie: które moduły są na dolnym pasku (i w jakiej kolejności) oraz które są ukryte. */
export default function CustomizeModulesScreen() {
  const { colors } = useTheme();
  const preferences = useModulePreferences();
  const [tabs, setTabs] = useState<TabModuleKey[]>(preferences.tabs);
  const [hidden, setHidden] = useState<ModuleKey[]>(preferences.hidden);

  const available = TAB_MODULES.filter((key) => !hidden.includes(key));
  const ordered = [...tabs, ...available.filter((key) => !tabs.includes(key))];

  const toggleTab = (key: TabModuleKey) => {
    if (tabs.includes(key)) {
      setTabs(tabs.filter((item) => item !== key));
    } else if (tabs.length >= MAX_EXTRA_TABS) {
      Alert.alert('Pasek jest pełny', `Obok „Dziś” zmieszczą się ${MAX_EXTRA_TABS} moduły. Najpierw odznacz któryś.`);
    } else {
      setTabs([...tabs, key]);
    }
  };

  const move = (key: TabModuleKey, direction: -1 | 1) => {
    const index = tabs.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= tabs.length) return;
    const next = [...tabs];
    [next[index], next[target]] = [next[target], next[index]];
    setTabs(next);
  };

  const toggleHidden = (key: ModuleKey) => {
    if (hidden.includes(key)) {
      setHidden(hidden.filter((item) => item !== key));
    } else {
      setHidden([...hidden, key]);
      if (isTabModule(key)) setTabs(tabs.filter((item) => item !== key));
    }
  };

  const save = () => {
    preferences.save(tabs, hidden);
    router.back();
  };

  return (
    <ScrollScreen title="Dostosuj" headerRight={<HeaderTextButton onPress={save} />}>
      <Section title={`Pasek zakładek · ${tabs.length + 1} z ${MAX_EXTRA_TABS + 1}`}>
        <Card variant="row">
          <Icon name="today" color={colors.accent} />
          <AppText style={styles.flex}>Dziś</AppText>
          <Icon name="lock" size={18} color={colors.textMuted} />
        </Card>
        {ordered.map((key) => {
          const index = tabs.indexOf(key);
          const selected = index >= 0;
          const module = MODULES[key];
          return (
            <Card key={key} variant="row" style={styles.row}>
              <CheckCircle
                checked={selected}
                onPress={() => toggleTab(key)}
                accessibilityLabel={selected ? `Usuń z paska: ${module.label}` : `Dodaj do paska: ${module.label}`}
              />
              <Icon name={module.icon} color={colors[module.color]} />
              <AppText style={styles.flex} numberOfLines={1}>
                {module.label}
              </AppText>
              {selected ? (
                <>
                  <IconButton
                    icon="arrow_upward"
                    accessibilityLabel={`Przesuń wcześniej: ${module.label}`}
                    color={index === 0 ? colors.border : colors.text}
                    onPress={() => move(key, -1)}
                  />
                  <IconButton
                    icon="arrow_downward"
                    accessibilityLabel={`Przesuń dalej: ${module.label}`}
                    color={index === tabs.length - 1 ? colors.border : colors.text}
                    onPress={() => move(key, 1)}
                  />
                </>
              ) : null}
            </Card>
          );
        })}
        <AppText variant="caption" tone="textMuted">
          Android mieści 5 zakładek. Moduły spoza paska otworzysz z ekranu Moduły (ikona w nagłówku ekranu Dziś).
        </AppText>
      </Section>

      <Section title="Widoczne moduły">
        {Object.values(MODULES)
          .filter((module) => !module.required)
          .map((module) => {
            const visible = !hidden.includes(module.key);
            return (
              <Card key={module.key} variant="row" style={styles.row}>
                <CheckCircle
                  checked={visible}
                  onPress={() => toggleHidden(module.key)}
                  accessibilityLabel={visible ? `Ukryj: ${module.label}` : `Pokaż: ${module.label}`}
                />
                <Icon name={module.icon} color={visible ? colors[module.color] : colors.textMuted} />
                <View style={styles.flex}>
                  <AppText tone={visible ? 'text' : 'textMuted'}>{module.label}</AppText>
                  <AppText variant="caption" tone="textMuted" numberOfLines={1}>
                    {module.description}
                  </AppText>
                </View>
              </Card>
            );
          })}
        <AppText variant="caption" tone="textMuted">
          Ukryty moduł znika z ekranu Moduły, skrótów na ekranie Dziś i statystyk. Dane zostają — możesz go w każdej chwili przywrócić.
        </AppText>
      </Section>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { paddingVertical: spacing.sm },
});
