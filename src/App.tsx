import { useState, useEffect } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";

type View = 'today' | 'history' | 'reminders';

interface DayNote {
  date: string;
  content: string;
}

interface Reminder {
  id: string;
  text: string;
  source: string;
  priority: 'high' | 'medium' | 'low';
}

// Dummy data for past days
const PAST_DAYS: DayNote[] = [
  {
    date: 'December 13, 2025',
    content: `Team meeting at 10am - discussed Q1 roadmap
- Launch new feature by end of January
- Need to hire 2 more engineers
- Marketing campaign starts next week

Lunch with Sarah - talked about the new project proposal
She's interested in collaborating on the ML integration

Finished reading "Atomic Habits" chapter 5
Key insight: Environment design is crucial for behavior change

Workout: 5km run in 28 minutes
Felt great, need to maintain this consistency`
  },
  {
    date: 'December 12, 2025',
    content: `Code review session - spotted several optimization opportunities
- Refactor database queries to reduce load time
- Implement caching layer for API responses

Doctor's appointment at 3pm - annual checkup
Everything looks good, need to focus more on sleep hygiene

Dinner ideas for the week:
- Monday: Grilled salmon with roasted vegetables
- Tuesday: Pasta with homemade marinara
- Wednesday: Stir-fry with tofu
- Thursday: Chicken tikka masala`
  },
  {
    date: 'December 11, 2025',
    content: `Morning meditation - 20 minutes
Felt more centered and focused throughout the day

Project deadline discussion with team
Extended timeline by 2 weeks to ensure quality
Better to ship it right than ship it fast

Called mom - her birthday is coming up next month
Need to order gift by the 15th

Watched documentary on renewable energy
Solar panel efficiency has improved dramatically`
  },
  {
    date: 'December 10, 2025',
    content: `Brainstorming session for new app features
Ideas:
- Dark mode toggle
- Export notes to PDF
- Voice-to-text integration
- Markdown support
- Collaborative editing

Finished setting up new development environment
M3 MacBook Pro is incredibly fast

Read 2 chapters of "The Design of Everyday Things"
Great insights on user-centered design principles`
  }
];

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
    const value = e.target.value;
    setNotes(value);
    localStorage.setItem('notes', value);
  };

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
          onClick={() => setCurrentView('history')}
        >
          History
        </button>
        <button
          className={`nav-link ${currentView === 'reminders' ? 'active' : ''}`}
          onClick={() => setCurrentView('reminders')}
        >
          Reminders
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
              {PAST_DAYS.map((day, index) => (
                <div key={index} className="history-card">
                  <div className="history-date">{day.date}</div>
                  <div className="history-content">{day.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'reminders' && (
          <div className="reminders-view">
            <div className="reminders-list">
              {REMINDERS.map((reminder) => (
                <div key={reminder.id} className={`reminder-card priority-${reminder.priority}`}>
                  <div className="reminder-header">
                    <span className={`priority-badge priority-${reminder.priority}`}>
                      {reminder.priority}
                    </span>
                    <span className="reminder-source">{reminder.source}</span>
                  </div>
                  <div className="reminder-text">{reminder.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
