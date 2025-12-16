export type View = 'today' | 'history' | 'reminders' | 'ai-logs';

export type StatusType = 'saving' | 'ai-running' | 'ai-success' | 'ai-no-action' | null;

export interface StatusState {
  type: StatusType;
  message?: string;
  remindersCount?: number;
}

export interface DayNote {
  id: string;
  text: string;
  for_date: string;
}

export interface Reminder {
  id: string;
  created_from_note_id: string;
  text: string;
  resolved: boolean;
  tags?: string;
}

export interface AiLog {
  id: number;
  note_id: number;
  prompt: string;
  response: string;
  success: boolean;
  reasoning: string;
  reminders_count: number;
  created_at: string;
}
