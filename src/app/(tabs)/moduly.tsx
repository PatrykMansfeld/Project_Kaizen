import { TabScreenMode } from '@/components/screen';
import { ModulesScreen } from '@/features/modules/modules-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <ModulesScreen />
    </TabScreenMode>
  );
}
