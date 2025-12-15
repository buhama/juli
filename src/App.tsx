import { useState, useEffect, useRef } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";

type View = 'today' | 'history' | 'reminders';

interface DayNote {
  id: string;
  text: string;
  for_date: string;
}

interface Reminder {
  id: string;
  text: string;
  source: string;
  priority: 'high' | 'medium' | 'low';
}


// Dummy AI-generated reminders
const REMINDERS: Reminder[] = [
  {
    id: '1',
    text: 'Team meeting scheduled for 10am - prepare Q1 roadmap presentation',
    source: 'December 13, 2025',
    priority: 'high'
  },
  {
    id: '2',
    text: "Order gift for mom's birthday by December 15th",
    source: 'December 11, 2025',
    priority: 'high'
  },
  {
    id: '3',
    text: 'Refactor database queries to reduce load time',
    source: 'December 12, 2025',
    priority: 'medium'
  },
  {
    id: '4',
    text: 'Marketing campaign starts next week - coordinate with team',
    source: 'December 13, 2025',
    priority: 'medium'
  },
  {
    id: '5',
    text: 'Maintain 5km running consistency for health goals',
    source: 'December 13, 2025',
    priority: 'low'
  },
  {
    id: '6',
    text: 'Implement caching layer for API responses',
    source: 'December 12, 2025',
    priority: 'medium'
  },
  {
    id: '7',
    text: 'Focus on sleep hygiene improvements',
    source: 'December 12, 2025',
    priority: 'low'
  }
];

function App() {
  const [currentView, setCurrentView] = useState<View>('today');
  const [notes, setNotes] = useState<DayNote | null>(null);
  const [currentDate, setCurrentDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pastDays, setPastDays] = useState<DayNote[]>([]);
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

  const filteredReminders = REMINDERS.filter(reminder =>
    reminder.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reminder.source.toLowerCase().includes(searchQuery.toLowerCase())
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
  };

  const handleGetApiKey = async () => {
    try {
      const result = await invoke<string>('test_claude_api');
      console.log('Claude API Response:', result);
    } catch (error) {
      console.error('Failed to get API key:', error);
    }
  }

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
                  <div key={reminder.id} className={`reminder-card priority-${reminder.priority}`}>
                    <div className="reminder-header">
                      <span className={`priority-badge priority-${reminder.priority}`}>
                        {reminder.priority}
                      </span>
                      <span className="reminder-source">{reminder.source}</span>
                    </div>
                    <div className="reminder-text">{reminder.text}</div>
                  </div>
                ))
              ) : (
                <div className="no-results">No reminders found</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
