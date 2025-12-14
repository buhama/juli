import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [notes, setNotes] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    setCurrentDate(now.toLocaleDateString('en-US', options));

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
    <div className="notes-container">
      <div className="date">{currentDate}</div>
      <textarea
        className="notes-area"
        value={notes}
        onChange={handleNotesChange}
        placeholder="Start typing..."
        autoFocus
        style={{ width: '100%' }}
      />
    </div>
  );
}

export default App;
