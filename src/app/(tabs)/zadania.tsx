import { TabScreenMode } from '@/components/screen';
import { TasksScreen } from '@/features/tasks/tasks-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <TasksScreen />
    </TabScreenMode>
  );
}
