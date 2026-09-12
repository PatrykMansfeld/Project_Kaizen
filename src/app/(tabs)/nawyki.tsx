import { TabScreenMode } from '@/components/screen';
import { HabitsScreen } from '@/features/habits/habits-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <HabitsScreen />
    </TabScreenMode>
  );
}
