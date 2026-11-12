export type ScheduleCategory = 'morning_routine' | 'work' | 'health' | 'evening' | 'task';

export interface ScheduleRoutine {
  id: string;
  title: string;
  time: string; // HH:MM
  durationMinutes: number;
  category: ScheduleCategory;
  completed: boolean;
  dayOfWeek: number; // 0 = Sun ... 6 = Sat
  notes?: string;
  linkedToAlarmId?: string;
}

export interface DayScheduleSummary {
  dayOfWeek: number;
  dateString: string;
  routines: ScheduleRoutine[];
  totalPlannedMinutes: number;
}
