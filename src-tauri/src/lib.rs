use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{Manager, State};
use serde::Serialize;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

struct Db(Mutex<Connection>);

#[derive(Debug, Serialize)]
struct NoteRow {
    id: i64,
    text: String,
    for_date: String,
}

#[tauri::command]
fn init_db(db: State<Db>) -> Result<(), String> {
    let conn = db.0.lock().unwrap();

    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          for_date TEXT NOT NULL UNIQUE
        );
        "#,
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn add_note(db: State<Db>, text: String, for_date: String) -> Result<i64, String> {
    let conn = db.0.lock().unwrap();

    conn.execute(
        "INSERT INTO notes (text, for_date) VALUES (?1, ?2)
         ON CONFLICT(for_date) DO UPDATE SET text = excluded.text",
        (text, for_date),
    ).map_err(|e| e.to_string())
    .map(|_| conn.last_insert_rowid())
}

#[tauri::command]
fn print_notes_table(db: State<Db>) -> Result<Vec<NoteRow>, String> {
    let conn = db.0.lock().unwrap();

    // Print table using pretty-sqlite
    println!("\n📊 Notes Table:");
    println!("{}", "=".repeat(80));

    match pretty_sqlite::print_select(&*conn, "SELECT * FROM notes ORDER BY id", []) {
        Ok(_) => {},
        Err(e) => println!("Error formatting table: {}", e),
    }

    println!("{}", "=".repeat(80));

    // Also return the data as JSON for the frontend
    let mut stmt = conn
        .prepare("SELECT id, text, for_date FROM notes ORDER BY id")
        .map_err(|e| e.to_string())?;

    let notes = stmt
        .query_map([], |row| {
            Ok(NoteRow {
                id: row.get(0)?,
                text: row.get(1)?,
                for_date: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(notes)
}


// ============================================================================
// DATE FORMATTING COMMAND
// ============================================================================

// This attribute macro makes the function callable from your frontend
// Think of it like exposing a function in an API endpoint
// In TypeScript, you might use something like app.get('/api/date', ...)
#[tauri::command]
fn get_formatted_date() -> String {
    // Import the Local struct from chrono to work with the system's local time
    // In TypeScript, this is similar to: new Date()
    // But Rust requires explicit imports for everything
    use chrono::Local;

    // Get the current date and time in the local timezone
    // Local::now() is similar to TypeScript's: new Date()
    // The type here is DateTime<Local>, which is more specific than JS's Date
    let now = Local::now();

    // Format the date using a format string
    // In TypeScript you used: toLocaleDateString('en-US', options)
    // In Rust, we use strftime-style format strings:
    //   %A = Full weekday name (e.g., "Monday")
    //   %B = Full month name (e.g., "December")
    //   %d = Day of month (e.g., "14")
    //   %Y = Full year (e.g., "2025")
    let formatted = now.format("%A, %B %d, %Y");

    // Convert the formatted date to a String
    // .to_string() is needed because format() returns a DelayedFormat type
    // In TypeScript, toLocaleDateString() already returns a string
    // Rust is more explicit about type conversions
    formatted.to_string()

    // Note on return values:
    // In Rust, the last expression without a semicolon is automatically returned
    // This is equivalent to: return formatted.to_string();
    // In TypeScript, you'd need an explicit `return` statement
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let path = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("app.sqlite");

            // Ensure directory exists
            std::fs::create_dir_all(path.parent().unwrap())
                .map_err(|e| e.to_string())?;

            // Open SQLite file
            let conn = Connection::open(path)
                .map_err(|e| e.to_string())?;

            // Store DB globally
            app.manage(Db(Mutex::new(conn)));

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        // Register Tauri commands here so they can be called from the frontend
        // Think of this like registering routes in an Express app
        // Each command name in the brackets becomes callable via invoke('command_name')
        .invoke_handler(tauri::generate_handler![greet, get_formatted_date, init_db, add_note, print_notes_table])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}