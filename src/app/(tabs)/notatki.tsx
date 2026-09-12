import { TabScreenMode } from '@/components/screen';
import { NotesScreen } from '@/features/notes/notes-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <NotesScreen />
    </TabScreenMode>
  );
}
