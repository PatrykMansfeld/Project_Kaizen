import { TabScreenMode } from '@/components/screen';
import { StatsScreen } from '@/features/stats/stats-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <StatsScreen />
    </TabScreenMode>
  );
}
