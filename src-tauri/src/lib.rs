// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
        .plugin(tauri_plugin_opener::init())
        // Register Tauri commands here so they can be called from the frontend
        // Think of this like registering routes in an Express app
        // Each command name in the brackets becomes callable via invoke('command_name')
        .invoke_handler(tauri::generate_handler![greet, get_formatted_date])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}