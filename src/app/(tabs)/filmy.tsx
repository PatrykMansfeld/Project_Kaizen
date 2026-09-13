import { TabScreenMode } from '@/components/screen';
import { MediaScreen } from '@/features/media/media-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <MediaScreen />
    </TabScreenMode>
  );
}
