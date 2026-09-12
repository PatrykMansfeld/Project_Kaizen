import { TabScreenMode } from '@/components/screen';
import { TodayScreen } from '@/features/day/today-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <TodayScreen />
    </TabScreenMode>
  );
}
