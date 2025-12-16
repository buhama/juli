import { useState, useEffect, useRef } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";

type View = 'today' | 'history' | 'reminders' | 'ai-logs';

type StatusType = 'saving' | 'ai-running' | 'ai-success' | 'ai-no-action' | null;

interface StatusState {
  type: StatusType;
  message?: string;
  remindersCount?: number;
}

interface DayNote {
  id: string;
  text: string;
  for_date: string;
}

interface Reminder {
  id: string;
  created_from_note_id: string;
  text: string;
  resolved: boolean;
  tags?: string;
}

interface AiLog {
  id: number;
  note_id: number;
  prompt: string;
  response: string;
  success: boolean;
  reasoning: string;
  reminders_count: number;
  created_at: string;
}

function App() {
  const [currentView, setCurrentView] = useState<View>('today');
  const [notes, setNotes] = useState<DayNote | null>(null);
  const [currentDate, setCurrentDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pastDays, setPastDays] = useState<DayNote[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [resolvedReminders, setResolvedReminders] = useState<Reminder[]>([]);
  const [showResolvedReminders, setShowResolvedReminders] = useState(false);
  const [aiLogs, setAiLogs] = useState<AiLog[]>([]);
  const [selectedReminderIndex, setSelectedReminderIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusState>({ type: null });
  const debounceTimerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const statusTimeoutRef = useRef<number | null>(null);

  const saveNote = async (text: string, forDate: string) => {
    try {
      // Show saving and AI running status
      setStatus({ type: 'saving' });

      // Clear any existing status timeout
      if (statusTimeoutRef.current !== null) {
        clearTimeout(statusTimeoutRef.current);
      }

      // Store current reminders count before saving
      const currentRemindersCount = reminders.length;

      // Update status to show AI is analyzing
      setTimeout(() => {
        setStatus({ type: 'ai-running' });
      }, 300);

      // The add_note call runs the AI analysis internally
      const result = await invoke<number>('add_note', { text, forDate });
      console.log('Note saved:', result);

      // After save completes (AI has already run), always refetch unresolved reminders
      const updatedReminders = await invoke<Reminder[]>('get_unresolved_reminders');
      setReminders(updatedReminders);

      const newRemindersCount = updatedReminders.length - currentRemindersCount;

      if (newRemindersCount > 0) {
        setStatus({ type: 'ai-success', remindersCount: newRemindersCount });
      } else {
        setStatus({ type: 'ai-no-action' });
      }

      // Auto-hide status after 3 seconds
      statusTimeoutRef.current = window.setTimeout(() => {
        setStatus({ type: null });
      }, 3000);

    } catch (error) {
      console.error('Failed to save note:', error);
      setStatus({ type: null });
    }
  };

  const handlePrintTable = async () => {
    try {
      const result = await invoke('print_all_tables');
      console.log('Notes from DB:', result);
      alert('Table printed to terminal! Check the console.');
    } catch (error) {
      console.error('Failed to print table:', error);
    }
  };

  useEffect(() => {
    invoke<void>('init_db')
      .catch((error) => {
        console.error('Failed to initialize database:', error);
      });
  }, []);

  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Cmd (Mac) or Ctrl (Windows/Linux) is pressed
      const modifierKey = e.metaKey || e.ctrlKey;

      if (!modifierKey) return;

      // Check for Cmd+Shift+R (reload)
      if (e.key.toLowerCase() === 'r' && e.shiftKey) {
        e.preventDefault();
        handleReload();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault();
          switchView('today');
          break;
        case 'h':
          e.preventDefault();
          switchView('history');
          break;
        case 'r':
          e.preventDefault();
          // If on today view and reminder already selected, switch to reminders view
          if (currentView === 'today' && selectedReminderIndex !== null) {
            switchView('reminders');
          } else if (currentView === 'today') {
            // If on today view but no reminder selected, select first unresolved reminder
            const unresolvedReminders = reminders.filter(r => !r.resolved);
            if (unresolvedReminders.length > 0) {
              setSelectedReminderIndex(0);
            }
          } else {
            // Otherwise, switch to reminders view
            switchView('reminders');
          }
          break;
        case 'l':
          e.preventDefault();
          switchView('ai-logs');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentView, notes, currentDate, reminders, selectedReminderIndex]);

  // Vim-style navigation for reminders
  useEffect(() => {
    const handleReminderNavigation = (e: KeyboardEvent) => {
      // Only handle if a reminder is selected
      if (selectedReminderIndex === null || currentView !== 'today') return;

      // Don't handle if modifier keys are pressed (let the main navigation handler deal with it)
      const modifierKey = e.metaKey || e.ctrlKey;
      if (modifierKey) return;

      const unresolvedReminders = reminders.filter(r => !r.resolved);

      switch (e.key.toLowerCase()) {
        case 'j':
          // Move down
          e.preventDefault();
          if (selectedReminderIndex < unresolvedReminders.length - 1) {
            setSelectedReminderIndex(selectedReminderIndex + 1);
          }
          break;
        case 'k':
          // Move up
          e.preventDefault();
          if (selectedReminderIndex > 0) {
            setSelectedReminderIndex(selectedReminderIndex - 1);
          }
          break;
        case 'r':
          // Resolve selected reminder (only if no modifier key pressed)
          e.preventDefault();
          if (unresolvedReminders[selectedReminderIndex]) {
            const reminderToResolve = unresolvedReminders[selectedReminderIndex];
            handleResolveReminder(reminderToResolve.id);
            // The next reminder will be selected in the resolve handler
          }
          break;
        case 'escape':
          // Deselect and return to textarea
          e.preventDefault();
          setSelectedReminderIndex(null);
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleReminderNavigation);

    return () => {
      window.removeEventListener('keydown', handleReminderNavigation);
    };
  }, [selectedReminderIndex, currentView, reminders]);

  // Position cursor at end of textarea when on today view
  useEffect(() => {
    if (currentView === 'today' && textareaRef.current && selectedReminderIndex === null) {
      const textarea = textareaRef.current;
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
      textarea.focus();
    }
  }, [currentView, notes, selectedReminderIndex]);

  useEffect(() => {
    const getDatesAndNotes = async () => {
      try {
        const formattedDate = await invoke<string>('get_formatted_date')

        if (formattedDate) {
          setCurrentDate(formattedDate);
        } else {
          throw new Error('Failed to get formatted date');
        }

        const note = await invoke<DayNote>('get_notes_for_date', { forDate: formattedDate });
        setNotes(note);

        // Load only unresolved reminders on initial load
        const remindersData = await invoke<Reminder[]>('get_unresolved_reminders');
        setReminders(remindersData);
      } catch (error) {
        console.error('Failed to get dates and notes:', error);
      }
    }

    void getDatesAndNotes();
  }, []);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!currentDate) return;

    const value = e.target.value;
    setNotes({ id: '', text: value, for_date: currentDate });

    // Clear existing timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for 30 seconds
    debounceTimerRef.current = window.setTimeout(() => {
      saveNote(value, currentDate);
    }, 30000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !currentDate) return;

    if (e.key === 'Enter') {
      // Clear the debounce timer
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Save immediately
      saveNote(notes?.text || '', currentDate);
    }
  };

  const filteredUnresolvedReminders = reminders.filter(reminder =>
    reminder.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredResolvedReminders = resolvedReminders.filter(reminder =>
    reminder.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleShowResolved = async () => {
    if (!showResolvedReminders) {
      // Fetch resolved reminders when showing them
      try {
        const resolved = await invoke<Reminder[]>('get_resolved_reminders');
        setResolvedReminders(resolved);
      } catch (error) {
        console.error('Failed to get resolved reminders:', error);
      }
    }
    setShowResolvedReminders(!showResolvedReminders);
  };

  const switchView = (view: View) => {
    // Save current notes before switching views (non-blocking)
    if (currentView === 'today' && notes?.text && currentDate) {
      // Clear the debounce timer
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Fire and forget - don't wait for save to complete
      void saveNote(notes.text, currentDate);
    }

    // Deselect any selected reminder when switching views
    setSelectedReminderIndex(null);

    // Switch view immediately
    setCurrentView(view);

    // Load data for specific views (non-blocking)
    if (view === 'history') {
      invoke<DayNote[]>('get_all_notes')
        .then((result) => {
          console.log('Past days:', result);
          setPastDays(result);
        })
        .catch((error) => {
          console.error('Failed to get all notes:', error);
        });
    }

    if (view === 'reminders') {
      // Only fetch unresolved reminders initially
      invoke<Reminder[]>('get_unresolved_reminders')
        .then((result) => {
          console.log('Unresolved reminders:', result);
          setReminders(result);
        })
        .catch((error) => {
          console.error('Failed to get unresolved reminders:', error);
        });
      // Reset resolved view when switching to reminders
      setShowResolvedReminders(false);
      setResolvedReminders([]);
    }

    if (view === 'ai-logs') {
      invoke<AiLog[]>('get_all_ai_logs')
        .then((result) => {
          console.log('AI Logs:', result);
          setAiLogs(result);
        })
        .catch((error) => {
          console.error('Failed to get AI logs:', error);
        });
    }
  };

  const handleGetApiKey = async () => {
    try {
      const result = await invoke<string>('test_claude_api');
      console.log('Claude API Response:', result);
    } catch (error) {
      console.error('Failed to get API key:', error);
    }
  }

  const handleResolveReminder = async (reminderId: string) => {
    try {
      await invoke('resolve_reminder', { reminderId: parseInt(reminderId) });
      // Refresh unresolved reminders list
      const updatedReminders = await invoke<Reminder[]>('get_unresolved_reminders');
      setReminders(updatedReminders);

      // If viewing resolved reminders, also refresh that list
      if (showResolvedReminders) {
        const updatedResolved = await invoke<Reminder[]>('get_resolved_reminders');
        setResolvedReminders(updatedResolved);
      }

      // If a reminder was selected, keep selection on next unresolved reminder
      if (selectedReminderIndex !== null) {
        if (updatedReminders.length > 0) {
          // Keep same index, or select last if we were at the end
          const newIndex = Math.min(selectedReminderIndex, updatedReminders.length - 1);
          setSelectedReminderIndex(newIndex);
        } else {
          // No more unresolved reminders, deselect and focus textarea
          setSelectedReminderIndex(null);
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }
      }
    } catch (error) {
      console.error('Failed to resolve reminder:', error);
    }
  };

  const handleUnresolveReminder = async (reminderId: string) => {
    try {
      await invoke('unresolve_reminder', { reminderId: parseInt(reminderId) });
      // Refresh unresolved reminders list
      const updatedReminders = await invoke<Reminder[]>('get_unresolved_reminders');
      setReminders(updatedReminders);

      // If viewing resolved reminders, also refresh that list
      if (showResolvedReminders) {
        const updatedResolved = await invoke<Reminder[]>('get_resolved_reminders');
        setResolvedReminders(updatedResolved);
      }
    } catch (error) {
      console.error('Failed to unresolve reminder:', error);
    }
  };

  const handleDeleteReminder = async (reminderId: string, isResolved: boolean = false) => {
    try {
      await invoke('delete_reminder', { reminderId: parseInt(reminderId) });
      // Refresh the appropriate list based on which reminder was deleted
      if (isResolved && showResolvedReminders) {
        const updatedResolved = await invoke<Reminder[]>('get_resolved_reminders');
        setResolvedReminders(updatedResolved);
      } else {
        const updatedReminders = await invoke<Reminder[]>('get_unresolved_reminders');
        setReminders(updatedReminders);
      }
    } catch (error) {
      console.error('Failed to delete reminder:', error);
    }
  };

  const handleDeleteAiLog = async (logId: number) => {
    try {
      await invoke('delete_ai_log', { logId });
      // Refresh AI logs list
      const updatedLogs = await invoke<AiLog[]>('get_all_ai_logs');
      setAiLogs(updatedLogs);
    } catch (error) {
      console.error('Failed to delete AI log:', error);
    }
  };

  const handleDeleteAllAiLogs = async () => {
    try {
      await invoke('delete_all_ai_logs');
      // Clear the logs list
      setAiLogs([]);
    } catch (error) {
      console.error('Failed to delete all AI logs:', error);
    }
  };

  const handleReload = async () => {
    try {
      // Re-initialize database
      await invoke<void>('init_db');

      // Reload date and today's notes
      const formattedDate = await invoke<string>('get_formatted_date');
      setCurrentDate(formattedDate);

      const note = await invoke<DayNote>('get_notes_for_date', { forDate: formattedDate });
      setNotes(note);

      // Reload unresolved reminders (always needed for today view)
      const remindersData = await invoke<Reminder[]>('get_unresolved_reminders');
      setReminders(remindersData);

      // If viewing resolved reminders, refresh that too
      if (showResolvedReminders) {
        const resolvedData = await invoke<Reminder[]>('get_resolved_reminders');
        setResolvedReminders(resolvedData);
      }

      // Reload current view's data
      if (currentView === 'history') {
        const historyData = await invoke<DayNote[]>('get_all_notes');
        setPastDays(historyData);
      } else if (currentView === 'ai-logs') {
        const logsData = await invoke<AiLog[]>('get_all_ai_logs');
        setAiLogs(logsData);
      }

      console.log('Reloaded all data');
    } catch (error) {
      console.error('Failed to reload:', error);
    }
  };

  return (
    <div className="app-container">
      {/* Global status indicator */}
      {status.type && (
        <div className={`status-indicator ${status.type}`}>
          {status.type === 'saving' && (
            <>
              <span className="status-dot"></span>
              <span className="status-text">Saving...</span>
            </>
          )}
          {status.type === 'ai-running' && (
            <>
              <span className="status-dot"></span>
              <span className="status-text">AI analyzing...</span>
            </>
          )}
          {status.type === 'ai-success' && (
            <>
              <span className="status-icon">✓</span>
              <span className="status-text">
                {status.remindersCount === 1
                  ? 'Added 1 reminder'
                  : `Added ${status.remindersCount} reminders`}
              </span>
            </>
          )}
          {status.type === 'ai-no-action' && (
            <>
              <span className="status-icon">✓</span>
              <span className="status-text">Saved</span>
            </>
          )}
        </div>
      )}

      {/* Minimal top navigation */}
      <nav className="top-nav">
        <button
          className={`nav-link ${currentView === 'today' ? 'active' : ''}`}
          onClick={() => switchView('today')}
        >
          Today
        </button>
        <button
          className={`nav-link ${currentView === 'history' ? 'active' : ''}`}
          onClick={() => switchView('history')}
        >
          History
        </button>
        <button
          className={`nav-link ${currentView === 'reminders' ? 'active' : ''}`}
          onClick={() => switchView('reminders')}
        >
          Reminders
        </button>
        <button
          className={`nav-link ${currentView === 'ai-logs' ? 'active' : ''}`}
          onClick={() => switchView('ai-logs')}
        >
          AI Logs
        </button>
        <button
          className="nav-link"
          onClick={handlePrintTable}
          style={{ marginLeft: 'auto' }}
        >
          Print DB
        </button>
        <button
          className="nav-link"
          onClick={handleGetApiKey}
          style={{ marginLeft: 'auto' }}
        >
          Get API Key
        </button>
        <button
          className="nav-link"
          onClick={handleReload}
        >
          Reload
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {currentView === 'today' && (
          <div className="today-view">
            <div className="date">{currentDate}</div>

            {/* Minimalistic unresolved reminders */}
            {reminders.filter(r => !r.resolved).length > 0 && (
              <div className="unresolved-reminders">
                <div className="unresolved-reminders-title">Reminders</div>
                {reminders.filter(r => !r.resolved).map((reminder, index) => (
                  <div
                    key={reminder.id}
                    className={`unresolved-reminder-item ${selectedReminderIndex === index ? 'selected' : ''}`}
                  >
                    <span className="unresolved-reminder-text">{reminder.text}</span>
                    {/* {reminder.tags && (
                      <div className="reminder-tags">
                        {reminder.tags.split(',').map((tag, idx) => (
                          <span key={idx} className="reminder-tag">{tag.trim()}</span>
                        ))}
                      </div>
                    )} */}
                    <button
                      className="mini-action-btn"
                      onClick={() => handleResolveReminder(reminder.id)}
                    >
                      resolve
                    </button>
                    <button
                      className="mini-action-btn delete"
                      onClick={() => handleDeleteReminder(reminder.id)}
                    >
                      delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              className="notes-area"
              value={notes?.text || ''}
              onChange={handleNotesChange}
              onKeyDown={handleKeyDown}
              placeholder="Start typing..."
            />
          </div>
        )}

        {currentView === 'history' && (
          <div className="history-view">
            <div className="history-list">
              {pastDays.map((day, index) => (
                <div key={index} className="history-card">
                  <div className="history-date">{day.for_date}</div>
                  <div className="history-content">{day.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'reminders' && (
          <div className="reminders-view">
            <div className="reminders-header">
              <input
                type="text"
                className="search-input"
                placeholder="Search reminders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                className={`toggle-resolved-btn ${showResolvedReminders ? 'active' : ''}`}
                onClick={toggleShowResolved}
              >
                {showResolvedReminders ? 'hide resolved' : 'show resolved'}
              </button>
            </div>
            <div className="reminders-list">
              {filteredUnresolvedReminders.length > 0 ? (
                filteredUnresolvedReminders.map((reminder) => (
                  <div key={reminder.id} className="reminder-card">
                    <div className="reminder-header">
                      <div className="reminder-content">
                        <div className="reminder-text">{reminder.text}</div>
                        {reminder.tags && (
                          <div className="reminder-tags">
                            {reminder.tags.split(',').map((tag, idx) => (
                              <span key={idx} className="reminder-tag">{tag.trim()}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="reminder-actions">
                        <button
                          className="action-btn"
                          onClick={() => handleResolveReminder(reminder.id)}
                        >
                          resolve
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => handleDeleteReminder(reminder.id)}
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-results">No unresolved reminders</div>
              )}

              {showResolvedReminders && (
                <>
                  {filteredResolvedReminders.length > 0 && (
                    <div className="resolved-section">
                      <div className="resolved-divider">resolved</div>
                      {filteredResolvedReminders.map((reminder) => (
                        <div key={reminder.id} className="reminder-card resolved">
                          <div className="reminder-header">
                            <div className="reminder-content">
                              <div className="reminder-text">{reminder.text}</div>
                              {reminder.tags && (
                                <div className="reminder-tags">
                                  {reminder.tags.split(',').map((tag, idx) => (
                                    <span key={idx} className="reminder-tag">{tag.trim()}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="reminder-actions">
                              <button
                                className="action-btn"
                                onClick={() => handleUnresolveReminder(reminder.id)}
                              >
                                unresolve
                              </button>
                              <button
                                className="action-btn delete"
                                onClick={() => handleDeleteReminder(reminder.id, true)}
                              >
                                delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {filteredResolvedReminders.length === 0 && (
                    <div className="no-results">No resolved reminders</div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {currentView === 'ai-logs' && (
          <div className="ai-logs-view">
            <div className="ai-logs-header">
              <button
                className="action-btn delete"
                onClick={handleDeleteAllAiLogs}
                disabled={aiLogs.length === 0}
              >
                Delete All
              </button>
            </div>
            <div className="ai-logs-list">
              {aiLogs.length > 0 ? (
                aiLogs.map((log) => (
                  <details key={log.id} className={`ai-log-card ${log.success ? 'success' : 'error'}`}>
                    <summary className="ai-log-summary">
                      <div className="log-header">
                        <div className="log-header-left">
                          <span className={`status-badge ${log.success ? 'success' : 'error'}`}>
                            {log.success ? '✓ Success' : '✗ Failed'}
                          </span>
                          <span className="log-date">{log.created_at}</span>
                        </div>
                        <button
                          className="action-btn delete"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeleteAiLog(log.id);
                          }}
                        >
                          delete
                        </button>
                      </div>
                      <div className="log-info">
                        <span className="log-note-id">Note #{log.note_id}</span>
                        <span className="log-count">{log.reminders_count} reminder{log.reminders_count !== 1 ? 's' : ''}</span>
                      </div>
                      {log.reasoning && (
                        <div className="log-reasoning">{log.reasoning}</div>
                      )}
                    </summary>
                    <div className="ai-log-details">
                      <div className="detail-section">
                        <h4>Prompt</h4>
                        <pre className="detail-content">{log.prompt}</pre>
                      </div>
                      <div className="detail-section">
                        <h4>Response</h4>
                        <pre className="detail-content">{log.response}</pre>
                      </div>
                    </div>
                  </details>
                ))
              ) : (
                <div className="no-results">No AI logs found</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
