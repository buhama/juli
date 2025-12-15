import { useState, useEffect } from "react";
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
  const [notes, setNotes] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pastDays, setPastDays] = useState<DayNote[]>([]);

  const handlePrintTable = async () => {
    try {
      const result = await invoke('print_notes_table');
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
    invoke<string>('get_formatted_date')
      .then((formattedDate) => {
        setCurrentDate(formattedDate);
      })
      .catch((error) => {
        console.error('Failed to get formatted date:', error);
      });

    const savedNotes = localStorage.getItem('notes');

    if (savedNotes) {
      setNotes(savedNotes);
    }
  }, []);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!currentDate) return;

    const value = e.target.value;
    setNotes(value);

    setTimeout(() => {
      localStorage.setItem('notes', value);

      invoke<number>('add_note', { text: value, forDate: currentDate })
        .catch((error) => {
          console.error('Failed to add note:', error);
        })
        .then((result) => {
          console.log('Note added:', result);
        });
    }, 500);
  };

  const filteredReminders = REMINDERS.filter(reminder =>
    reminder.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reminder.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const switchToHistoryView = async () => {
    try {
      const result = await invoke<DayNote[]>('get_all_notes');
      console.log('Past days:', result);
      setPastDays(result);
    } catch (error) {
      console.error('Failed to get all notes:', error);
    }
    setCurrentView('history');
  }

  return (
    <div className="app-container">
      {/* Minimal top navigation */}
      <nav className="top-nav">
        <button
          className={`nav-link ${currentView === 'today' ? 'active' : ''}`}
          onClick={() => setCurrentView('today')}
        >
          Today
        </button>
        <button
          className={`nav-link ${currentView === 'history' ? 'active' : ''}`}
          onClick={switchToHistoryView}
        >
          History
        </button>
        <button
          className={`nav-link ${currentView === 'reminders' ? 'active' : ''}`}
          onClick={() => setCurrentView('reminders')}
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
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {currentView === 'today' && (
          <div className="today-view">
            <div className="date">{currentDate}</div>
            <textarea
              className="notes-area"
              value={notes}
              onChange={handleNotesChange}
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
