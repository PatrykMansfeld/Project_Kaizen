import type { ComponentType } from 'react';

import { ActivityScreen } from '@/features/activity/activity-screen';
import { BillsScreen } from '@/features/bills/bills-screen';
import { FinanceScreen } from '@/features/finance/finance-screen';
import { HabitsScreen } from '@/features/habits/habits-screen';
import { HomeScreen } from '@/features/home/home-screen';
import { MediaScreen } from '@/features/media/media-screen';
import { MedsScreen } from '@/features/meds/meds-screen';
import { ModulesScreen } from '@/features/modules/modules-screen';
import { NotesScreen } from '@/features/notes/notes-screen';
import { SkillsScreen } from '@/features/skills/skills-screen';
import { StatsScreen } from '@/features/stats/stats-screen';
import { TasksScreen } from '@/features/tasks/tasks-screen';
import { TripsScreen } from '@/features/trips/trips-screen';

import type { TabModuleKey } from './registry';

/** Ekrany modułów, które mogą być zakładkami — do trasy /modul/[key] (gdy nie są na pasku). */
export const MODULE_SCREENS: Record<TabModuleKey, ComponentType> = {
  nawyki: HabitsScreen,
  zadania: TasksScreen,
  aktywnosc: ActivityScreen,
  notatki: NotesScreen,
  finanse: FinanceScreen,
  statystyki: StatsScreen,
  oplaty: BillsScreen,
  leki: MedsScreen,
  umiejetnosci: SkillsScreen,
  dom: HomeScreen,
  filmy: MediaScreen,
  podroze: TripsScreen,
  moduly: ModulesScreen,
};
