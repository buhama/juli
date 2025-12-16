import { useState, useCallback } from "react";
import type { Reminder } from "../lib/types";
import * as api from "../services/api";

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [resolvedReminders, setResolvedReminders] = useState<Reminder[]>([]);
  const [showResolvedReminders, setShowResolvedReminders] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadUnresolvedReminders = useCallback(async () => {
    try {
      const data = await api.getUnresolvedReminders();
      setReminders(data);
      return data;
    } catch (error) {
      console.error('Failed to get unresolved reminders:', error);
      return [];
    }
  }, []);

  const loadResolvedReminders = useCallback(async () => {
    try {
      const data = await api.getResolvedReminders();
      setResolvedReminders(data);
      return data;
    } catch (error) {
      console.error('Failed to get resolved reminders:', error);
      return [];
    }
  }, []);

  const toggleShowResolved = useCallback(async () => {
    if (!showResolvedReminders) {
      await loadResolvedReminders();
    }
    setShowResolvedReminders(!showResolvedReminders);
  }, [showResolvedReminders, loadResolvedReminders]);

  const resolveReminder = useCallback(async (reminderId: string) => {
    try {
      await api.resolveReminder(parseInt(reminderId));
      const updatedReminders = await api.getUnresolvedReminders();
      setReminders(updatedReminders);

      if (showResolvedReminders) {
        const updatedResolved = await api.getResolvedReminders();
        setResolvedReminders(updatedResolved);
      }

      return updatedReminders;
    } catch (error) {
      console.error('Failed to resolve reminder:', error);
      return null;
    }
  }, [showResolvedReminders]);

  const unresolveReminder = useCallback(async (reminderId: string) => {
    try {
      await api.unresolveReminder(parseInt(reminderId));
      const updatedReminders = await api.getUnresolvedReminders();
      setReminders(updatedReminders);

      if (showResolvedReminders) {
        const updatedResolved = await api.getResolvedReminders();
        setResolvedReminders(updatedResolved);
      }
    } catch (error) {
      console.error('Failed to unresolve reminder:', error);
    }
  }, [showResolvedReminders]);

  const deleteReminder = useCallback(async (reminderId: string, isResolved: boolean = false) => {
    try {
      await api.deleteReminder(parseInt(reminderId));
      if (isResolved && showResolvedReminders) {
        const updatedResolved = await api.getResolvedReminders();
        setResolvedReminders(updatedResolved);
      } else {
        const updatedReminders = await api.getUnresolvedReminders();
        setReminders(updatedReminders);
      }
    } catch (error) {
      console.error('Failed to delete reminder:', error);
    }
  }, [showResolvedReminders]);

  const filteredUnresolvedReminders = reminders.filter(reminder =>
    reminder.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredResolvedReminders = resolvedReminders.filter(reminder =>
    reminder.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetResolvedView = useCallback(() => {
    setShowResolvedReminders(false);
    setResolvedReminders([]);
  }, []);

  return {
    reminders,
    setReminders,
    resolvedReminders,
    showResolvedReminders,
    searchQuery,
    setSearchQuery,
    toggleShowResolved,
    resolveReminder,
    unresolveReminder,
    deleteReminder,
    loadUnresolvedReminders,
    loadResolvedReminders,
    filteredUnresolvedReminders,
    filteredResolvedReminders,
    resetResolvedView,
  };
}
