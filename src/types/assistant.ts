import { Alarm } from './alarm';

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
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
