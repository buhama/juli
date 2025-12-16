import { useEffect, useCallback } from "react";
import type { View, Reminder } from "../lib/types";

interface UseKeyboardNavigationOptions {
  currentView: View;
  reminders: Reminder[];
  selectedReminderIndex: number | null;
  setSelectedReminderIndex: (index: number | null) => void;
  onViewSwitch: (view: View) => void;
  onReload: () => void;
  onResolveReminder: (reminderId: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useKeyboardNavigation({
  currentView,
  reminders,
  selectedReminderIndex,
  setSelectedReminderIndex,
  onViewSwitch,
  onReload,
  onResolveReminder,
  textareaRef,
}: UseKeyboardNavigationOptions) {
  // Global navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifierKey = e.metaKey || e.ctrlKey;

      if (!modifierKey) return;

      // Cmd+Shift+R for reload
      if (e.key.toLowerCase() === 'r' && e.shiftKey) {
        e.preventDefault();
        onReload();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault();
          onViewSwitch('today');
          break;
        case 'h':
          e.preventDefault();
          onViewSwitch('history');
          break;
        case 'r':
          e.preventDefault();
          if (currentView === 'today' && selectedReminderIndex !== null) {
            onViewSwitch('reminders');
          } else if (currentView === 'today') {
            const unresolvedReminders = reminders.filter(r => !r.resolved);
            if (unresolvedReminders.length > 0) {
              setSelectedReminderIndex(0);
            }
          } else {
            onViewSwitch('reminders');
          }
          break;
        case 'l':
          e.preventDefault();
          onViewSwitch('ai-logs');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, reminders, selectedReminderIndex, onViewSwitch, onReload, setSelectedReminderIndex]);

  // Vim-style navigation for reminders
  useEffect(() => {
    const handleReminderNavigation = (e: KeyboardEvent) => {
      if (selectedReminderIndex === null || currentView !== 'today') return;

      const modifierKey = e.metaKey || e.ctrlKey;
      if (modifierKey) return;

      const unresolvedReminders = reminders.filter(r => !r.resolved);

      switch (e.key.toLowerCase()) {
        case 'j':
          e.preventDefault();
          if (selectedReminderIndex < unresolvedReminders.length - 1) {
            setSelectedReminderIndex(selectedReminderIndex + 1);
          }
          break;
        case 'k':
          e.preventDefault();
          if (selectedReminderIndex > 0) {
            setSelectedReminderIndex(selectedReminderIndex - 1);
          }
          break;
        case 'r':
          e.preventDefault();
          if (unresolvedReminders[selectedReminderIndex]) {
            onResolveReminder(unresolvedReminders[selectedReminderIndex].id);
          }
          break;
        case 'escape':
          e.preventDefault();
          setSelectedReminderIndex(null);
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleReminderNavigation);
    return () => window.removeEventListener('keydown', handleReminderNavigation);
  }, [selectedReminderIndex, currentView, reminders, setSelectedReminderIndex, onResolveReminder, textareaRef]);

  // Focus textarea when on today view
  const focusTextarea = useCallback(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
      textarea.focus();
    }
  }, [textareaRef]);

  return { focusTextarea };
}
