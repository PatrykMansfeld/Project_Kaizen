import { TabScreenMode } from '@/components/screen';
import { SkillsScreen } from '@/features/skills/skills-screen';

export default function Tab() {
  return (
    <TabScreenMode>
      <SkillsScreen />
    </TabScreenMode>
  );
}
