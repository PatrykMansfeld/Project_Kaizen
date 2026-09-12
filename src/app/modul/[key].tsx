import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/empty-state';
import { StackHeader } from '@/components/screen';
import { MODULE_SCREENS } from '@/features/modules/module-screens';
import { isTabModule } from '@/features/modules/registry';

/** Moduł otwarty nad zakładkami (gdy nie ma go na dolnym pasku): /modul/wydatki itd. */
export default function ModuleRoute() {
  const { key } = useLocalSearchParams<{ key: string }>();
  if (!key || !isTabModule(key)) {
    return (
      <>
        <StackHeader title="Moduł" />
        <EmptyState icon="apps" title="Nie ma takiego modułu" />
      </>
    );
  }
  const ModuleScreen = MODULE_SCREENS[key];
  return <ModuleScreen />;
}
