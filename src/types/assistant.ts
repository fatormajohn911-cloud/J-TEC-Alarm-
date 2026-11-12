import { Alarm } from './alarm';
import { ScheduleCategory, ScheduleRoutine } from './schedule';

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type AssistantActionType =
  | 'set_alarm'
  | 'update_alarm'
  | 'delete_alarm'
  | 'toggle_alarm'
  | 'add_routine'
  | 'delete_routine';

export type UndoPayload =
  | { kind: 'delete_alarm'; alarmId: string }
  | { kind: 'restore_alarm'; previousAlarm: Alarm }
  | { kind: 'recreate_alarm'; deletedAlarm: Alarm }
  | { kind: 'delete_routines'; routineIds: string[] }
  | { kind: 'recreate_routine'; deletedRoutine: ScheduleRoutine };

export interface AssistantActionResult {
  id: string;
  type: AssistantActionType;
  title: string;
  subtitle?: string;
  alarmId?: string;
  routineDay?: number;
  undone?: boolean;
  undoPayload: UndoPayload;
}

export interface ProposedAlarmData {
  mode: 'create' | 'update' | 'toggle';
  targetAlarmId?: string;
  previousAlarm?: Alarm;
  time: string; // HH:MM
  label: string;
  days: number[];
  snoozeIntervalMinutes: number;
  aiBriefing: boolean;
  enabled: boolean;
}

export interface ProposedRoutineItem {
  id: string;
  title: string;
  time: string; // HH:MM
  days: number[];
  durationMinutes: number;
  category: ScheduleCategory;
}

export interface ProposedDeleteData {
  targetType: 'alarm' | 'routine';
  targetId: string;
  title: string;
  subtitle: string;
  alarmSnapshot?: Alarm;
  routineSnapshot?: ScheduleRoutine;
}

export type ProposalStatus = 'pending' | 'approved' | 'cancelled';

export interface AssistantProposal {
  id: string;
  kind: 'alarm_proposal' | 'routine_plan' | 'delete_proposal';
  status: ProposalStatus;
  alarmData?: ProposedAlarmData;
  routineItems?: ProposedRoutineItem[];
  deleteData?: ProposedDeleteData;
  appliedAction?: AssistantActionResult;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  proposals?: AssistantProposal[];
  actions?: AssistantActionResult[];
  parsedAlarm?: Partial<Alarm>;
  actionSuggested?: 'confirm_alarm' | 'view_schedule' | 'edit_routine';
  isStagedPhase2Notice?: boolean;
}

export interface AssistantVoicePreset {
  id: 'warm' | 'coach' | 'executive';
  title: string;
  tagline: string;
  previewSample: string;
}
