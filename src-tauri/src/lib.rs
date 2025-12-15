use std::{env, sync::Mutex};

use rusqlite::Connection;
use tauri::{Manager, State};
use serde::Serialize;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ============================================================================
// DATABASE STATE WRAPPER
// ============================================================================

// This is a "tuple struct" that wraps our database connection
// Think of it like: class Db { constructor(public connection: Mutex<Connection>) }
// But in Rust, we use a tuple struct for simple wrappers with a single field
//
// Mutex<Connection> is crucial for thread safety:
// - Mutex is like a lock that ensures only ONE thread can access the data at a time
// - In TypeScript, you don't usually worry about this because JS is single-threaded
// - But Rust apps can run code on multiple threads, so we need protection
// - When you call .lock(), you get exclusive access until the lock is released
struct Db(Mutex<Connection>);

// ============================================================================
// NOTE DATA STRUCTURE
// ============================================================================

// This defines the shape of data we'll send to the frontend
// Think of it like a TypeScript interface:
// interface NoteRow {
//   id: number;
//   text: string;
//   for_date: string;
// }
//
// The attributes above the struct are "derive macros":
// - #[derive(Debug)] - Lets you print the struct for debugging (like console.log)
// - #[derive(Serialize)] - Converts this struct to JSON automatically
//   In TypeScript, objects are already JSON-compatible
//   In Rust, we need explicit serialization via the serde crate
#[derive(Debug, Serialize)]
struct NoteRow {
    id: i64,         // i64 is a 64-bit integer (TypeScript's number type)
    text: String,    // String is Rust's owned string type (like TypeScript's string)
    for_date: String, // We store dates as strings for simplicity
}

// ============================================================================
// DATABASE INITIALIZATION COMMAND
// ============================================================================

// This command sets up the database schema (creates tables if they don't exist)
// In TypeScript/Node.js, you might do this in a migration file or setup script
#[tauri::command]
fn init_db(db: State<Db>) -> Result<(), String> {
    // State<Db> is Tauri's way of passing shared state to commands
    // Think of it like dependency injection in TypeScript:
    // In Angular: constructor(private db: DbService)
    // In Express: function handler(req, res) { const db = req.app.locals.db }
    //
    // Return type Result<(), String> means:
    // - Success: Ok(()) - the empty tuple () is like TypeScript's void
    // - Error: Err(String) - an error message as a string
    // This is Rust's way of handling errors instead of try/catch

    // Access the database connection from our State wrapper
    // db.0 accesses the first (and only) field in the Db tuple struct
    // .lock() acquires the Mutex lock (waits if another thread has it)
    // .unwrap() says "panic if the lock is poisoned" (rare, usually means another thread crashed)
    //
    // In TypeScript, you'd just access db.connection directly
    // Rust makes thread safety explicit with Mutex
    let conn = db.0.lock().unwrap();

    // Execute multiple SQL statements at once
    // execute_batch is like running multiple db.query() calls in TypeScript
    //
    // r#"..."# is a "raw string literal" - no need to escape quotes inside
    // In TypeScript: `SELECT * FROM "users"`
    // In Rust raw string: r#"SELECT * FROM "users""#
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          for_date TEXT NOT NULL UNIQUE
        );
        "#,
    )
    // map_err converts the rusqlite::Error to a String
    // This is necessary because our function returns Result<(), String>
    // In TypeScript: .catch(e => throw e.toString())
    .map_err(|e| e.to_string())?;
    // The ? operator is shorthand for:
    // if error, return Err(error) immediately
    // if ok, unwrap and continue
    // In TypeScript, this is like: await query() with automatic error propagation

    // Return success
    // Ok(()) wraps the empty tuple in the Result type
    // In TypeScript, you might just: return; or return undefined;
    Ok(())
}

// ============================================================================
// ADD/UPDATE NOTE COMMAND
// ============================================================================

// This command inserts a new note or updates an existing one for a given date
// In TypeScript: async function addNote(text: string, for_date: string): Promise<number>
#[tauri::command]
fn add_note(db: State<Db>, text: String, for_date: String) -> Result<i64, String> {
    // Parameters:
    // - db: State<Db> - our shared database connection (injected by Tauri)
    // - text: String - the note content (owned String, not a reference)
    // - for_date: String - the date this note is for
    //
    // Return type Result<i64, String>:
    // - Success: Ok(i64) - returns the row ID of the inserted/updated note
    // - Error: Err(String) - error message if something goes wrong
    // i64 is a 64-bit signed integer (TypeScript's number)

    // Lock the database connection for thread-safe access
    // Same pattern as init_db - acquire exclusive access to the database
    let conn = db.0.lock().unwrap();

    // Execute a single SQL statement with parameters
    // This uses "UPSERT" logic (INSERT or UPDATE if exists)
    //
    // Parameterized queries (?1, ?2):
    // - ?1 refers to the first parameter (text)
    // - ?2 refers to the second parameter (for_date)
    // - This prevents SQL injection, just like prepared statements in TypeScript
    // - In TypeScript: db.query('INSERT INTO notes VALUES ($1, $2)', [text, for_date])
    //
    // ON CONFLICT(for_date) DO UPDATE:
    // - If a note for this date already exists, update it instead of failing
    // - excluded.text refers to the value we tried to insert
    // - Like: if (exists) { update() } else { insert() }
    conn.execute(
        "INSERT INTO notes (text, for_date) VALUES (?1, ?2)
         ON CONFLICT(for_date) DO UPDATE SET text = excluded.text",
        (text, for_date), // Tuple of parameters that match ?1 and ?2
    )
    // If execute() returns an error, convert it to String
    .map_err(|e| e.to_string())
    // If execute() succeeds, it returns the number of affected rows
    // We ignore that (_) and instead get the ID of the last inserted row
    // In TypeScript: .then(() => db.getLastInsertId())
    .map(|_| conn.last_insert_rowid())
    // The whole chain returns Result<i64, String>
    // No need for Ok() wrapper because map() already wraps it
}

// ============================================================================
// FETCH ALL NOTES COMMAND
// ============================================================================

#[tauri::command]
fn get_all_notes(db: State<Db>) -> Result<Vec<NoteRow>, String> {
    let conn = db.0.lock().unwrap();

    let mut stmt = conn.prepare("SELECT * FROM notes ORDER BY id").map_err(|e| e.to_string())?;

    let notes = stmt.query_map([], |row| {
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

#[tauri::command]
fn get_notes_for_date(db: State<Db>, for_date: String) -> Result<NoteRow, String> {
    let conn = db.0.lock().unwrap();

    let mut stmt = conn.prepare("SELECT * FROM notes WHERE for_date = ?1 ORDER BY id").map_err(|e| e.to_string())?;

    let note = stmt.query_row([for_date], |row| {
        Ok(NoteRow {
            id: row.get(0)?,
            text: row.get(1)?,
            for_date: row.get(2)?,
        })
    })
    .map_err(|e| e.to_string())?;

    Ok(note)
}

// This command retrieves all notes from the database
// It also prints them to the console for debugging (you'll see this in your terminal)
// In TypeScript: async function getAllNotes(): Promise<NoteRow[]>
#[tauri::command]
fn print_notes_table(db: State<Db>) -> Result<Vec<NoteRow>, String> {
    // Return type Result<Vec<NoteRow>, String>:
    // - Success: Ok(Vec<NoteRow>) - returns a vector (array) of NoteRow structs
    // - Error: Err(String) - error message
    // Vec<NoteRow> is like TypeScript's NoteRow[]

    // Lock the database connection
    let conn = db.0.lock().unwrap();

    // ========================================================================
    // PART 1: Print to console for debugging
    // ========================================================================

    // println! is Rust's version of console.log
    // The \n adds a blank line before the output
    println!("\n📊 Notes Table:");

    // "=".repeat(80) creates a string of 80 equal signs (like "=".repeat(80) in JS)
    // {} is a placeholder for the string (like ${} in template literals)
    println!("{}", "=".repeat(80));

    // Use the pretty-sqlite library to print a nicely formatted table
    // match is like a switch statement, but more powerful
    // It handles both success (Ok) and error (Err) cases
    //
    // &*conn is a bit complex:
    // - conn is a MutexGuard (the locked reference)
    // - *conn dereferences it to get the Connection
    // - &*conn takes a reference to that Connection
    // - This is needed because print_select expects &Connection
    // In TypeScript, you wouldn't need to worry about these reference conversions
    match pretty_sqlite::print_select(&*conn, "SELECT * FROM notes ORDER BY id", []) {
        Ok(_) => {},  // Success - the underscore means we ignore the return value
        Err(e) => println!("Error formatting table: {}", e), // Print error if it fails
    }

    println!("{}", "=".repeat(80));

    // ========================================================================
    // PART 2: Fetch data to return to the frontend
    // ========================================================================

    // Prepare a SQL statement (like creating a prepared statement in TypeScript)
    // .prepare() returns Result<Statement, Error>
    // We use ? to propagate any errors up to the caller
    //
    // let mut stmt means "mutable statement" - we need to mutate it to query it
    // In TypeScript, everything is mutable by default
    // In Rust, everything is immutable unless you explicitly say mut
    let mut stmt = conn
        .prepare("SELECT id, text, for_date FROM notes ORDER BY id")
        .map_err(|e| e.to_string())?;

    // Query the database and map each row to a NoteRow struct
    // This is a complex chain of operations:
    let notes = stmt
        // query_map takes parameters ([]) and a closure (|row| {...})
        // The closure runs for each row in the result set
        // In TypeScript: rows.map(row => ({ id: row.id, text: row.text, ... }))
        .query_map([], |row| {
            // |row| is a closure parameter (like an arrow function parameter)
            // row.get(0) gets the first column (id)
            // row.get(1) gets the second column (text)
            // row.get(2) gets the third column (for_date)
            // The ? propagates errors within this closure
            Ok(NoteRow {
                id: row.get(0)?,      // Get column 0 (id) from the row
                text: row.get(1)?,    // Get column 1 (text)
                for_date: row.get(2)?, // Get column 2 (for_date)
            })
        })
        .map_err(|e| e.to_string())?
        // At this point we have an iterator of Result<NoteRow, Error>
        // .collect() converts the iterator into a Vec<NoteRow>
        // The turbofish ::<Result<Vec<_>, _>> tells Rust what type to collect into
        // Result<Vec<_>, _> means: Result containing a Vec of something, or an error
        // The underscores (_) let Rust infer the specific types
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
        // After collecting, we have Result<Vec<NoteRow>, Error>
        // The ? unwraps it, returning early if there's an error

    // Return the notes wrapped in Ok
    // In TypeScript: return notes;
    // In Rust: return Ok(notes); (but we omit 'return' for the last expression)
    Ok(notes)
}

#[tauri::command]
fn get_api_key() -> Result<String, String> {
    env::var("CLAUDE_API_KEY")
        .map_err(|_| "CLAUDE_API_KEY not set. Create a .env file.".to_string())
}

#[tauri::command]
async fn test_claude_api() -> Result<String, String> {
    let api_key = get_api_key()?;

    let prompt = "What is the capital of France?";

    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    });

    let response: reqwest::Response = client
    .post("https://api.anthropic.com/v1/messages")
    .header("x-api-key", &api_key)
    .header("anthropic-version", "2023-06-01")
    .header("content-type", "application/json")
    .json(&body)
    .send()
    .await
    .map_err(|e| format!("API request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API error: {}", error_text));
    }

    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Extract the text content from Claude's response
    let content = response_json["content"][0]["text"]
        .as_str()
        .ok_or("Nos text in response")?;

    Ok(content.to_string())
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

// ============================================================================
// APPLICATION ENTRY POINT
// ============================================================================

// This attribute applies cfg_attr only on mobile platforms
// It marks this function as the entry point for mobile builds
// You can ignore this for desktop development
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();
    // Start building the Tauri application
    // Builder pattern is common in Rust (like fluent APIs in TypeScript)
    // Think of it like: new TauriApp().setup(...).plugin(...).run()
    tauri::Builder::default()
        // .setup() runs once when the app starts (like main() or constructor())
        // |app| is a closure parameter - the app instance
        // In TypeScript: .setup((app) => { ... })
        .setup(|app| {
            // ================================================================
            // DATABASE SETUP
            // ================================================================

            // Build the path to the SQLite database file
            // This will be in the app's data directory, which varies by OS:
            // - macOS: ~/Library/Application Support/com.juli.app/app.sqlite
            // - Windows: C:\Users\<user>\AppData\Roaming\com.juli.app\app.sqlite
            // - Linux: ~/.config/com.juli.app/app.sqlite
            let path = app
                .path()              // Get the path resolver
                .app_data_dir()      // Get the app data directory path
                .map_err(|e| e.to_string())?  // Convert error to String if it fails
                .join("app.sqlite"); // Append "app.sqlite" to the path
                // In TypeScript: path.join(appDataDir, 'app.sqlite')

            // Create the directory if it doesn't exist
            // path.parent() gets the directory containing the file
            // .unwrap() panics if there's no parent (shouldn't happen here)
            // create_dir_all creates all missing directories in the path (like mkdir -p)
            // In TypeScript: fs.mkdirSync(path.dirname(dbPath), { recursive: true })
            std::fs::create_dir_all(path.parent().unwrap())
                .map_err(|e| e.to_string())?;

            // Open (or create) the SQLite database file
            // Connection::open() creates the file if it doesn't exist
            // In TypeScript: const db = new Database(dbPath)
            let conn = Connection::open(path)
                .map_err(|e| e.to_string())?;

            // Store the database connection globally so all commands can access it
            // app.manage() makes the Db state available to all Tauri commands
            // Db(Mutex::new(conn)) wraps the connection in our tuple struct
            // In TypeScript: app.locals.db = db (Express) or providers: [DbService] (Angular)
            app.manage(Db(Mutex::new(conn)));

            // Return Ok(()) to indicate setup succeeded
            Ok(())
        })
        // Register plugins (like middleware in Express)
        // tauri-plugin-opener allows opening URLs and files
        .plugin(tauri_plugin_opener::init())
        // Register Tauri commands here so they can be called from the frontend
        // Think of this like registering routes in an Express app
        // Each command name in the brackets becomes callable via invoke('command_name')
        .invoke_handler(tauri::generate_handler![
            greet,
            get_formatted_date,
            init_db,
            add_note,
            print_notes_table,
            get_all_notes,
            get_notes_for_date,
            get_api_key,
            test_claude_api,
        ])
        // Start the application event loop
        // This blocks until the app exits
        // In TypeScript: app.listen(3000)
        .run(tauri::generate_context!())
        // If run() fails, panic with an error message
        // .expect() is like .unwrap() but lets you provide a custom error message
        .expect("error while running tauri application");
}