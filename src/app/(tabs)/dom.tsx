import { TabScreenMode } from '@/components/screen';
import { HomeScreen } from '@/features/home/home-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <HomeScreen />
    </TabScreenMode>
  );
}
