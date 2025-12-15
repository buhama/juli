import { useState, useEffect } from "react";
import "./App.css";
// Import invoke to call Rust functions from the frontend
// This is like calling an API endpoint, but it's actually calling Rust code
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [notes, setNotes] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    // Instead of using JavaScript's Date API, we're calling our Rust function
    // invoke() is async and returns a Promise, just like fetch()
    // The string 'get_formatted_date' matches the Rust function name
    invoke<string>('get_formatted_date')
      .then((formattedDate) => {
        // The Rust function returns the formatted date string
        setCurrentDate(formattedDate);
      })
      .catch((error) => {
        // Always good to handle errors when calling Rust commands
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
