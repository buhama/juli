import { useState, useRef, useCallback } from "react";
import type { DayNote, StatusState } from "../lib/types";
import * as api from "../services/api";

interface UseNotesOptions {
  onRemindersUpdate: (reminders: Awaited<ReturnType<typeof api.getUnresolvedReminders>>) => void;
  remindersCount: number;
}

export function useNotes({ onRemindersUpdate, remindersCount }: UseNotesOptions) {
  const [notes, setNotes] = useState<DayNote | null>(null);
  const [currentDate, setCurrentDate] = useState("");
  const [status, setStatus] = useState<StatusState>({ type: null });
  const debounceTimerRef = useRef<number | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const saveNote = useCallback(async (text: string, forDate: string) => {
    try {
      setStatus({ type: 'saving' });

      if (statusTimeoutRef.current !== null) {
        clearTimeout(statusTimeoutRef.current);
      }

      const currentRemindersCount = remindersCount;

      setTimeout(() => {
        setStatus({ type: 'ai-running' });
      }, 300);

      const result = await api.addNote(text, forDate);
      console.log('Note saved:', result);

      const updatedReminders = await api.getUnresolvedReminders();
      onRemindersUpdate(updatedReminders);

      const newRemindersCount = updatedReminders.length - currentRemindersCount;

      if (newRemindersCount > 0) {
        setStatus({ type: 'ai-success', remindersCount: newRemindersCount });
      } else {
        setStatus({ type: 'ai-no-action' });
      }

      statusTimeoutRef.current = window.setTimeout(() => {
        setStatus({ type: null });
      }, 3000);

    } catch (error) {
      console.error('Failed to save note:', error);
      setStatus({ type: null });
    }
  }, [onRemindersUpdate, remindersCount]);

  const handleNotesChange = useCallback((text: string) => {
    if (!currentDate) return;

    setNotes({ id: '', text, for_date: currentDate });

    clearDebounceTimer();

    debounceTimerRef.current = window.setTimeout(() => {
      saveNote(text, currentDate);
    }, 30000);
  }, [currentDate, clearDebounceTimer, saveNote]);

  const handleSaveImmediate = useCallback(() => {
    if (!currentDate) return;
    clearDebounceTimer();
    saveNote(notes?.text || '', currentDate);
  }, [currentDate, clearDebounceTimer, saveNote, notes?.text]);

  const loadTodayNote = useCallback(async () => {
    try {
      const formattedDate = await api.getFormattedDate();
      if (formattedDate) {
        setCurrentDate(formattedDate);
        const note = await api.getNotesForDate(formattedDate);
        setNotes(note);
        return formattedDate;
      }
      throw new Error('Failed to get formatted date');
    } catch (error) {
      console.error('Failed to get dates and notes:', error);
      return null;
    }
  }, []);

  return {
    notes,
    setNotes,
    currentDate,
    setCurrentDate,
    status,
    handleNotesChange,
    handleSaveImmediate,
    loadTodayNote,
    saveNote,
    clearDebounceTimer,
  };
}
