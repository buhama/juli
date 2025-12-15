import { useState, useEffect, useRef } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";

type View = 'today' | 'history' | 'reminders' | 'ai-logs';

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
  const [aiLogs, setAiLogs] = useState<AiLog[]>([]);
  const debounceTimerRef = useRef<number | null>(null);

  const saveNote = async (text: string, forDate: string) => {
    try {
      const result = await invoke<number>('add_note', { text, forDate });
      console.log('Note saved:', result);
    } catch (error) {
      console.error('Failed to save note:', error);
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

  const filteredReminders = reminders.filter(reminder =>
    reminder.text.toLowerCase().includes(searchQuery.toLowerCase()) 
  );

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
      invoke<Reminder[]>('get_all_reminders')
        .then((result) => {
          console.log('Reminders:', result);
          setReminders(result);
        })
        .catch((error) => {
          console.error('Failed to get all reminders:', error);
        });
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
      // Refresh reminders list
      const updatedReminders = await invoke<Reminder[]>('get_all_reminders');
      setReminders(updatedReminders);
    } catch (error) {
      console.error('Failed to resolve reminder:', error);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await invoke('delete_reminder', { reminderId: parseInt(reminderId) });
      // Refresh reminders list
      const updatedReminders = await invoke<Reminder[]>('get_all_reminders');
      setReminders(updatedReminders);
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

  return (
    <div className="app-container">
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
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {currentView === 'today' && (
          <div className="today-view">
            <div className="date">{currentDate}</div>
            <textarea
              className="notes-area"
              value={notes?.text || ''}
              onChange={handleNotesChange}
              onKeyDown={handleKeyDown}
              placeholder="Start typing..."
              autoFocus
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
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="Search reminders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="reminders-list">
              {filteredReminders.length > 0 ? (
                filteredReminders.map((reminder) => (
                  <div key={reminder.id} className={`reminder-card ${reminder.resolved ? 'resolved' : ''}`}>
                    <div className="reminder-header">
                      <div className="reminder-text">{reminder.text}</div>
                      <div className="reminder-actions">
                        {!reminder.resolved && (
                          <button
                            className="action-btn"
                            onClick={() => handleResolveReminder(reminder.id)}
                          >
                            resolve
                          </button>
                        )}
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
                <div className="no-results">No reminders found</div>
              )}
            </div>
          </div>
        )}

        {currentView === 'ai-logs' && (
          <div className="ai-logs-view">
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
