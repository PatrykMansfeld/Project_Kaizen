import { TabScreenMode } from '@/components/screen';
import { TripsScreen } from '@/features/trips/trips-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <TripsScreen />
    </TabScreenMode>
  );
}
