import { TabScreenMode } from '@/components/screen';
import { BillsScreen } from '@/features/bills/bills-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <BillsScreen />
    </TabScreenMode>
  );
}
