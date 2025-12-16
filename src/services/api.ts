import { invoke } from "@tauri-apps/api/core";
import type { DayNote, Reminder, AiLog } from "../lib/types";

// Database
export async function initDb(): Promise<void> {
  return invoke<void>('init_db');
}

// Date
export async function getFormattedDate(): Promise<string> {
  return invoke<string>('get_formatted_date');
}

// Notes
export async function getNotesForDate(forDate: string): Promise<DayNote> {
  return invoke<DayNote>('get_notes_for_date', { forDate });
}

export async function getAllNotes(): Promise<DayNote[]> {
  return invoke<DayNote[]>('get_all_notes');
}

export async function addNote(text: string, forDate: string): Promise<number> {
  return invoke<number>('add_note', { text, forDate });
}

// Reminders
export async function getUnresolvedReminders(): Promise<Reminder[]> {
  return invoke<Reminder[]>('get_unresolved_reminders');
}

export async function getResolvedReminders(): Promise<Reminder[]> {
  return invoke<Reminder[]>('get_resolved_reminders');
}

export async function resolveReminder(reminderId: number): Promise<void> {
  return invoke('resolve_reminder', { reminderId });
}

export async function unresolveReminder(reminderId: number): Promise<void> {
  return invoke('unresolve_reminder', { reminderId });
}

export async function deleteReminder(reminderId: number): Promise<void> {
  return invoke('delete_reminder', { reminderId });
}

// AI Logs
export async function getAllAiLogs(): Promise<AiLog[]> {
  return invoke<AiLog[]>('get_all_ai_logs');
}

export async function deleteAiLog(logId: number): Promise<void> {
  return invoke('delete_ai_log', { logId });
}

export async function deleteAllAiLogs(): Promise<void> {
  return invoke('delete_all_ai_logs');
}

// Debug
export async function printAllTables(): Promise<void> {
  return invoke('print_all_tables');
}

export async function testClaudeApi(): Promise<string> {
  return invoke<string>('test_claude_api');
}
