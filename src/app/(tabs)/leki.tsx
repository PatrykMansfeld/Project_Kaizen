import { TabScreenMode } from '@/components/screen';
import { MedsScreen } from '@/features/meds/meds-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <MedsScreen />
    </TabScreenMode>
  );
}
