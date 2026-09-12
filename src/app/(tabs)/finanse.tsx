import { TabScreenMode } from '@/components/screen';
import { FinanceScreen } from '@/features/finance/finance-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <FinanceScreen />
    </TabScreenMode>
  );
}
