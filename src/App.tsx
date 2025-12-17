import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

import type { View, DayNote } from "./lib/types";
import * as api from "./services/api";
import { useNotes, useReminders, useAiLogs, useKeyboardNavigation } from "./hooks";
import {
  StatusIndicator,
  TopNav,
  TodayView,
  HistoryView,
  RemindersView,
  AiLogsView,
} from "./components";

function App() {
  const [currentView, setCurrentView] = useState<View>('today');
  const [pastDays, setPastDays] = useState<DayNote[]>([]);
  const [selectedReminderIndex, setSelectedReminderIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    reminders,
    setReminders,
    searchQuery,
    setSearchQuery,
    showResolvedReminders,
    toggleShowResolved,
    resolveReminder,
    unresolveReminder,
    deleteReminder,
    loadUnresolvedReminders,
    filteredUnresolvedReminders,
    filteredResolvedReminders,
    resetResolvedView,
  } = useReminders();

  const {
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
  } = useNotes({
    onRemindersUpdate: setReminders,
    remindersCount: reminders.length,
  });

  const { aiLogs, loadAiLogs, deleteAiLog, deleteAllAiLogs } = useAiLogs();

  // Handle resolving reminder with selection management
  const handleResolveReminder = useCallback(async (reminderId: string) => {
    const updatedReminders = await resolveReminder(reminderId);

    if (selectedReminderIndex !== null && updatedReminders) {
      if (updatedReminders.length > 0) {
        const newIndex = Math.min(selectedReminderIndex, updatedReminders.length - 1);
        setSelectedReminderIndex(newIndex);
      } else {
        setSelectedReminderIndex(null);
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    }
  }, [resolveReminder, selectedReminderIndex]);

  const handleReload = useCallback(async () => {
    try {
      await api.initDb();

      const formattedDate = await api.getFormattedDate();
      setCurrentDate(formattedDate);

      const note = await api.getNotesForDate(formattedDate);
      setNotes(note);

      const remindersData = await api.getUnresolvedReminders();
      setReminders(remindersData);

      if (showResolvedReminders) {
        await toggleShowResolved();
      }

      if (currentView === 'history') {
        const historyData = await api.getAllNotes();
        setPastDays(historyData);
      } else if (currentView === 'ai-logs') {
        await loadAiLogs();
      }

      console.log('Reloaded all data');
    } catch (error) {
      console.error('Failed to reload:', error);
    }
  }, [currentView, showResolvedReminders, setCurrentDate, setNotes, setReminders, toggleShowResolved, loadAiLogs]);

  const switchView = useCallback((view: View) => {
    // Save current notes before switching views
    if (currentView === 'today' && notes?.text && currentDate) {
      clearDebounceTimer();
      void saveNote(notes.text, currentDate);
    }

    setSelectedReminderIndex(null);
    setCurrentView(view);

    if (view === 'history') {
      api.getAllNotes()
        .then((result) => {
          console.log('Past days:', result);
          setPastDays(result);
        })
        .catch((error) => {
          console.error('Failed to get all notes:', error);
        });
    }

    if (view === 'reminders') {
      loadUnresolvedReminders();
      resetResolvedView();
    }

    if (view === 'ai-logs') {
      loadAiLogs();
    }
  }, [currentView, notes?.text, currentDate, clearDebounceTimer, saveNote, loadUnresolvedReminders, resetResolvedView, loadAiLogs]);

  useKeyboardNavigation({
    currentView,
    reminders,
    selectedReminderIndex,
    setSelectedReminderIndex,
    onViewSwitch: switchView,
    onReload: handleReload,
    onResolveReminder: handleResolveReminder,
    textareaRef,
  });

  // Initialize database
  useEffect(() => {
    api.initDb().catch((error) => {
      console.error('Failed to initialize database:', error);
    });
  }, []);

  // Load today's note and reminders on mount
  useEffect(() => {
    const init = async () => {
      await loadTodayNote();
      await loadUnresolvedReminders();
    };
    void init();
  }, [loadTodayNote, loadUnresolvedReminders]);

  // Focus textarea when on today view
  useEffect(() => {
    if (currentView === 'today' && textareaRef.current && selectedReminderIndex === null) {
      const textarea = textareaRef.current;
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
      textarea.focus();
    }
  }, [currentView, notes, selectedReminderIndex]);

  const handleNotesChangeWrapper = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (selectedReminderIndex !== null) {
      setSelectedReminderIndex(null);
    }
    handleNotesChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && currentDate) {
      handleSaveImmediate();
    }
  };

  const handleSelectReminder = useCallback((index: number) => {
    setSelectedReminderIndex(index);
  }, []);

  const handleDeselectReminders = useCallback(() => {
    setSelectedReminderIndex(null);
  }, []);

  const handlePrintTable = async () => {
    try {
      await api.printAllTables();
      console.log('Notes from DB printed');
      alert('Table printed to terminal! Check the console.');
    } catch (error) {
      console.error('Failed to print table:', error);
    }
  };

  const handleGetApiKey = async () => {
    try {
      const result = await api.testClaudeApi();
      console.log('Claude API Response:', result);
    } catch (error) {
      console.error('Failed to get API key:', error);
    }
  };

  return (
    <div className="app-container">
      <StatusIndicator status={status} />

      <TopNav
        currentView={currentView}
        onViewSwitch={switchView}
        onPrintTable={handlePrintTable}
        onGetApiKey={handleGetApiKey}
        onReload={handleReload}
      />

      <main className="main-content">
        {currentView === 'today' && (
          <TodayView
            currentDate={currentDate}
            notes={notes}
            reminders={reminders}
            selectedReminderIndex={selectedReminderIndex}
            textareaRef={textareaRef}
            onNotesChange={handleNotesChangeWrapper}
            onKeyDown={handleKeyDown}
            onResolveReminder={handleResolveReminder}
            onDeleteReminder={deleteReminder}
            onSelectReminder={handleSelectReminder}
            onDeselectReminders={handleDeselectReminders}
          />
        )}

        {currentView === 'history' && (
          <HistoryView pastDays={pastDays} />
        )}

        {currentView === 'reminders' && (
          <RemindersView
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showResolvedReminders={showResolvedReminders}
            onToggleShowResolved={toggleShowResolved}
            filteredUnresolvedReminders={filteredUnresolvedReminders}
            filteredResolvedReminders={filteredResolvedReminders}
            onResolveReminder={resolveReminder}
            onUnresolveReminder={unresolveReminder}
            onDeleteReminder={deleteReminder}
          />
        )}

        {currentView === 'ai-logs' && (
          <AiLogsView
            aiLogs={aiLogs}
            onDeleteAiLog={deleteAiLog}
            onDeleteAllAiLogs={deleteAllAiLogs}
          />
        )}
      </main>
    </div>
  );
}

export default App;
