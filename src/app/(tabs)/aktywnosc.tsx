import { TabScreenMode } from '@/components/screen';
import { ActivityScreen } from '@/features/activity/activity-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <ActivityScreen />
    </TabScreenMode>
  );
}
