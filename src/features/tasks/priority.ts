import type { Priority } from '@/db/tasks';
import type { ThemeColors } from '@/theme/theme';

export function priorityColor(priority: Priority, colors: ThemeColors) {
  switch (priority) {
    case 3:
      return colors.danger;
    case 2:
      return colors.warning;
    case 1:
      return colors.tasks;
    default:
      return colors.textMuted;
  }
}
