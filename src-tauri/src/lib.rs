use std::{env, sync::Mutex};

use rusqlite::Connection;
use tauri::{Manager, State};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex as TokioMutex;

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

// A lock to ensure only one AI analysis runs at a time
// This prevents race conditions where the same note gets analyzed twice
// before the first analysis has created reminders
// Uses TokioMutex because it needs to be held across async await points
struct AiLock(TokioMutex<()>);

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
    for_date: String, // Wes store dates as strings for simplicity
}

#[derive(Debug, Serialize)]
struct ReminderRow {
    id: i64,
    text: String,
    resolved: bool,
    created_from_note_id: i64,
    tags: Option<String>,
}

#[derive(Debug, Serialize)]
struct AiLogRow {
    id: i64,
    note_id: i64,
    prompt: String,
    response: String,
    success: bool,
    reasoning: String,
    reminders_count: i64,
    created_at: String,
}

// What the AI returns when analyzing a note
// We use this to parse the AI's JSON response
#[derive(Debug, Deserialize)]
struct AiExtractedReminder {
    text: String,                    // The reminder text
    action: String,
    update_id: Option<i64>,
    tags: Option<String>,            // Comma-separated tags
    // due_date: Option<String>,        // "2025-12-20" or null
    // notify_before_hours: Option<i64>, // How many hours before due date to notify
}

#[derive(Debug, Deserialize)]
struct AiAnalysisResponse {
    reminders: Vec<AiExtractedReminder>,
    reasoning: String,
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

        CREATE TABLE IF NOT EXISTS reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          created_from_note_id INTEGER NOT NULL,
          text TEXT NOT NULL,
          resolved BOOLEAN NOT NULL DEFAULT FALSE,
          tags TEXT
        );

        CREATE TABLE IF NOT EXISTS ai_interaction_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          note_id INTEGER NOT NULL,
          prompt TEXT NOT NULL,
          response TEXT NOT NULL,
          success BOOLEAN NOT NULL,
          reasoning TEXT NOT NULL DEFAULT '',
          reminders_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS last_used_note_in_ai (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          note_text TEXT NOT NULL
        );
        "#,
    )
    // map_err converts the rusqlite::Error to a String
    // This is necessary because our function returns Result<(), String>
    // In TypeScript: .catch(e => throw e.toString())
    .map_err(|e| e.to_string())?;

    // Add resolved_at column to existing reminders table (for analytics)
    // This will fail silently if the column already exists
    let _ = conn.execute("ALTER TABLE reminders ADD COLUMN resolved_at TEXT", ());
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
async fn add_note(db: State<'_, Db>, ai_lock: State<'_, AiLock>, text: String, for_date: String) -> Result<i64, String> {
    // Parameters:
    // - db: State<Db> - our shared database connection (injected by Tauri)
    // - ai_lock: State<AiLock> - lock to prevent concurrent AI analyses
    // - text: String - the note content (owned String, not a reference)
    // - for_date: String - the date this note is for
    //
    // Return type Result<i64, String>:
    // - Success: Ok(i64) - returns the row ID of the inserted/updated note
    // - Error: Err(String) - error message if something goes wrong
    // i64 is a 64-bit signed integer (TypeScript's number)

    // Clone text before using it, since we'll need it again after the lock is released
    let note_text = text.clone();
    let for_date_clone = for_date.clone();

    // Lock the database connection for thread-safe access
    // Same pattern as init_db - acquire exclusive access to the database
    let note_id = {
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
        .map_err(|e| e.to_string())?;

        // Fetch the actual note ID by querying for the note with this date
        // This works whether we inserted or updated
        let mut stmt = conn.prepare("SELECT id FROM notes WHERE for_date = ?1")
            .map_err(|e| e.to_string())?;

        let note_id: i64 = stmt.query_row([for_date_clone], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        note_id
    };

    create_reminder_from_note(db, ai_lock, note_id, note_text).await?;

    Ok(note_id)
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
fn print_all_tables(db: State<Db>) -> Result<Vec<NoteRow>, String> {
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

    // Print reminders table
    println!("\n🔔 Reminders Table:");
    println!("{}", "=".repeat(80));

    match pretty_sqlite::print_select(&*conn, "SELECT * FROM reminders ORDER BY id", []) {
        Ok(_) => {},
        Err(e) => println!("Error formatting table: {}", e),
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
async fn test_claude_api(prompt: String) -> Result<String, String> {
    let api_key = get_api_key()?;

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

    let mut content_string = content.to_string();
    content_string = content_string.replace("```json", "");
    content_string = content_string.replace("```", "");

    Ok(content_string)
}

// This is the AI prompt we'll send to analyze notesnotes
fn build_analysis_prompt(note_text: &str, current_date: &str, reminders: &Vec<ReminderRow>) -> String {
    let reminders_text = reminders.iter().map(|reminder| format!("{}: {} (existing tags: {})", reminder.id, reminder.text, reminder.tags.as_deref().unwrap_or(""))).collect::<Vec<String>>().join("\n");
    let reminders_prompt = if reminders_text.is_empty() {
        "".to_string()
    } else {
        format!("These are the existing reminders, dont create any duplicates: \n{}", reminders_text)
    };

    format!(r#"You are analyzing a note to extract actionable reminders. Today's date is {}.

Analyze this note and extract any tasks, reminders, or action items. For each one, determine:
1. The reminder text (what needs to be done)
2. The due date (if mentioned or implied)
3. How many hours before the due date to notify the user
4. Tags (if the user ends a sentence with --[comma separated list])

Common patterns to recognize:
- "before eow" / "by end of week" = Friday of current week
- "before eom" / "by end of month" = last day of month
- "tomorrow" = next day
- "today" / "eod" = same day
- "next week" = 7 days from now
- Specific dates like "Dec 20" or "12/20"
- No deadline mentioned = null for due_date

For tags:
- If a sentence ends with --[tag1, tag2, tag3], extract those as tags,
- Remove the --[tags] part from the reminder text
- Store tags as a comma-separated string like "tag1,tag2,tag3"
- Example: "Call John about the project --[work, urgent]" should extract tags "work,urgent" and text "Call John about the project"
- If no tags are specified, use null
- Note that the user may provide tags in a different format em dash or double dash or single dash, use context to understand what is a tag

CRITICAL DUPLICATE DETECTION RULES:
- If a reminder already exists with the EXACT SAME text and tags, DO NOT include it in your response at all (no CREATE, no UPDATE)
- ONLY use UPDATE action if the tags have actually CHANGED (different tags than what currently exists)
- If the reminder text and tags are identical to an existing reminder, simply omit it from your response - this is not an actionable change
- Do NOT update a reminder just to "confirm" that tags remain the same - that's a waste of database operations

For notify_before_hours:
- Same day tasks: 0 hours (notify immediately when due)
- Tomorrow tasks: 12 hours (notify evening before)
- This week tasks: 24 hours (notify day before)
- Longer term: 48 hours (notify 2 days before)

Respond ONLY with valid JSON in this exact format, just straight JSON, no template literals or anything else:
{{
  "reminders": [
    {{
      "text": "Message Jon about the project (due date: 2025-12-20) (notify before: 24 hours)",
      "action": "CREATE" | "UPDATE",
      "update_id": 1,
      "tags": "work,urgent"
    }}
  ],
  "reasoning": "Explain your decision here - why you extracted these reminders, or why you found no actionable items in the note."
}}

{}

If there are no actionable items, respond with:
{{"reminders": [], "reasoning": "No actionable tasks or deadlines found in this note."}}

Note to analyze:
{}
"#, current_date, reminders_prompt, note_text)
}

fn get_all_reminders_impl(db: &State<'_, Db>) -> Result<Vec<ReminderRow>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT * FROM reminders ORDER BY id").map_err(|e| e.to_string())?;
    let reminders = stmt.query_map([], |row| {
        Ok(ReminderRow {
            id: row.get(0)?,
            created_from_note_id: row.get(1)?,
            text: row.get(2)?,
            resolved: row.get(3)?,
            tags: row.get(4)?,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(reminders)
}

#[tauri::command]
fn get_all_reminders(db: State<'_, Db>) -> Result<Vec<ReminderRow>, String> {
    get_all_reminders_impl(&db)
}

#[tauri::command]
async fn create_reminder_from_note(db: State<'_, Db>, ai_lock: State<'_, AiLock>, note_id: i64, note_text: String) -> Result<(), String> {
    // Acquire the AI lock to ensure only one analysis runs at a time
    // This prevents race conditions from rapid successive saves
    let _lock = ai_lock.0.lock().await;

    // Check if this note has already been processed by AI
    // If the note text is identical to the last one processed, skip AI analysis
    {
        let conn = db.0.lock().unwrap();
        let mut stmt = conn.prepare("SELECT note_text FROM last_used_note_in_ai WHERE id = 1")
            .map_err(|e| e.to_string())?;

        let last_note_text: Result<String, _> = stmt.query_row([], |row| row.get(0));

        // If we found a previous note and it matches the current one, skip AI processing
        if let Ok(last_text) = last_note_text {
            if last_text == note_text {
                println!("⏭️  Skipping AI analysis - note unchanged from last AI processing");
                return Ok(());
            }
        }
    }

    let current_date = get_formatted_date();
    let reminders = get_all_reminders_impl(&db)?;

    let prompt = build_analysis_prompt(note_text.as_str(), &current_date, &reminders);

    // Try to call the AI API and log the result
    let api_result = test_claude_api(prompt.clone()).await;

    match api_result {
        Ok(response) => {
            // Try to parse the AI response
            match serde_json::from_str::<AiAnalysisResponse>(&response) {
                Ok(analysis) => {
                    // Success! Insert reminders
                    let conn = db.0.lock().unwrap();
                    let reminders_count = analysis.reminders.len() as i64;

                    for extracted in &analysis.reminders {
                        if extracted.action == "CREATE" {
                            conn.execute(
                                "INSERT INTO reminders (created_from_note_id, text, tags) VALUES (?1, ?2, ?3)",
                                (note_id, &extracted.text, &extracted.tags),
                            )
                            .map_err(|e| e.to_string())?;
                        } else if extracted.action == "UPDATE" {
                            conn.execute(
                                "UPDATE reminders SET text = ?1, tags = ?2 WHERE id = ?3",
                                (&extracted.text, &extracted.tags, &extracted.update_id)
                            ).map_err(|e| e.to_string())?;

                        }
                    }

                    // Log successful AI interaction
                    conn.execute(
                        "INSERT INTO ai_interaction_logs (note_id, prompt, response, success, reasoning, reminders_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        (note_id, &prompt, &response, true, &analysis.reasoning, reminders_count),
                    )
                    .map_err(|e| e.to_string())?;

                    // Update the last used note in AI table
                    // This uses UPSERT logic to either insert or update the single row
                    conn.execute(
                        "INSERT INTO last_used_note_in_ai (id, note_text) VALUES (1, ?1)
                         ON CONFLICT(id) DO UPDATE SET note_text = excluded.note_text",
                        (&note_text,),
                    )
                    .map_err(|e| e.to_string())?;

                    Ok(())
                },
                Err(e) => {
                    // Failed to parse AI response
                    let error_msg = format!("Failed to parse AI response as JSON: {}. Response was: {}", e, response);
                    let conn = db.0.lock().unwrap();

                    // Log failed AI interaction
                    conn.execute(
                        "INSERT INTO ai_interaction_logs (note_id, prompt, response, success, reasoning, reminders_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        (note_id, &prompt, &error_msg, false, "", 0),
                    )
                    .map_err(|e| e.to_string())?;

                    Err(error_msg)
                }
            }
        },
        Err(e) => {
            // AI API call failed
            let error_msg = format!("AI API call failed: {}", e);
            let conn = db.0.lock().unwrap();

            // Log failed AI interaction
            conn.execute(
                "INSERT INTO ai_interaction_logs (note_id, prompt, response, success, reasoning, reminders_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                (note_id, &prompt, &error_msg, false, "", 0),
            )
            .map_err(|e| e.to_string())?;

            Err(error_msg)
        }
    }
}

#[tauri::command]
fn resolve_reminder(db: State<'_, Db>, reminder_id: i64) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE reminders SET resolved = 1, resolved_at = datetime('now') WHERE id = ?1",
        (reminder_id,),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn unresolve_reminder(db: State<'_, Db>, reminder_id: i64) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE reminders SET resolved = 0, resolved_at = NULL WHERE id = ?1",
        (reminder_id,),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_reminder(db: State<'_, Db>, reminder_id: i64) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM reminders WHERE id = ?1", (reminder_id,))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_all_ai_logs(db: State<'_, Db>) -> Result<Vec<AiLogRow>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT * FROM ai_interaction_logs ORDER BY id DESC").map_err(|e| e.to_string())?;
    let logs = stmt.query_map([], |row| {
        Ok(AiLogRow {
            id: row.get(0)?,
            note_id: row.get(1)?,
            prompt: row.get(2)?,
            response: row.get(3)?,
            success: row.get(4)?,
            reasoning: row.get(5)?,
            reminders_count: row.get(6)?,
            created_at: row.get(7)?,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(logs)
}

#[tauri::command]
fn delete_ai_log(db: State<'_, Db>, log_id: i64) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM ai_interaction_logs WHERE id = ?1", (log_id,))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_all_ai_logs(db: State<'_, Db>) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM ai_interaction_logs", ())
        .map_err(|e| e.to_string())?;
    Ok(())
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

            // Initialize the AI lock to prevent concurrent analyses
            app.manage(AiLock(TokioMutex::new(())));

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
            print_all_tables,
            get_all_notes,
            get_notes_for_date,
            get_api_key,
            test_claude_api,
            get_all_reminders,
            resolve_reminder,
            unresolve_reminder,
            delete_reminder,
            get_all_ai_logs,
            delete_ai_log,
            delete_all_ai_logs,
        ])
        // Start the application event loop
        // This blocks until the app exits
        // In TypeScript: app.listen(3000)
        .run(tauri::generate_context!())
        // If run() fails, panic with an error message
        // .expect() is like .unwrap() but lets you provide a custom error message
        .expect("error while running tauri application");
}