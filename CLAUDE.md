# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Tauri v2 desktop application with a React + TypeScript frontend. It's a simple notes application that demonstrates Tauri command invocation from the frontend to the Rust backend.

## Development Commands

```bash
# Run development server (starts both Vite dev server and Tauri)
npm run dev

# Build the application
npm run build

# Preview production build
npm run preview

# Direct Tauri CLI access
npm run tauri <command>
```

## Architecture

### Frontend (React + TypeScript)

#### File Structure
```
src/
├── components/               # React components
│   ├── views/               # View components (pages)
│   │   ├── today-view.tsx   # Today's notes view
│   │   ├── history-view.tsx # Notes history view
│   │   ├── reminders-view.tsx # Reminders management view
│   │   ├── ai-logs-view.tsx # AI logs view
│   │   └── index.ts         # View exports
│   ├── status-indicator.tsx # Status indicator component
│   ├── top-nav.tsx          # Navigation component
│   └── index.ts             # Component exports
├── hooks/                   # Custom React hooks
│   ├── use-notes.ts         # Notes state and operations
│   ├── use-reminders.ts     # Reminders state and operations
│   ├── use-ai-logs.ts       # AI logs state and operations
│   ├── use-keyboard-navigation.ts # Keyboard shortcuts
│   └── index.ts             # Hook exports
├── lib/                     # Shared utilities
│   └── types.ts             # TypeScript type definitions
├── services/                # External service integrations
│   └── api.ts               # Tauri backend API calls
├── App.tsx                  # Main application component
├── App.css                  # Application styles
├── main.tsx                 # React entry point
└── vite-env.d.ts           # Vite type declarations
```

#### Key Conventions
- **Component files**: Use kebab-case (e.g., `today-view.tsx`, `status-indicator.tsx`)
- **Hook files**: Use kebab-case with `use-` prefix (e.g., `use-notes.ts`)
- **Barrel exports**: Each folder has an `index.ts` for clean imports

#### Services Layer (`src/services/api.ts`)
All Tauri backend interactions are centralized in the API service:
- `initDb()` - Initialize database
- `getFormattedDate()` - Get current date
- `getNotesForDate(forDate)` - Get notes for a specific date
- `getAllNotes()` - Get all notes
- `addNote(text, forDate)` - Add/update a note
- `getUnresolvedReminders()` - Get unresolved reminders
- `getResolvedReminders()` - Get resolved reminders
- `resolveReminder(id)` - Mark reminder as resolved
- `unresolveReminder(id)` - Mark reminder as unresolved
- `deleteReminder(id)` - Delete a reminder
- `getAllAiLogs()` - Get all AI logs
- `deleteAiLog(id)` - Delete an AI log
- `deleteAllAiLogs()` - Delete all AI logs

#### Custom Hooks
- **`useNotes`**: Manages note state, auto-save with debounce, and status updates
- **`useReminders`**: Manages reminders state, filtering, and CRUD operations
- **`useAiLogs`**: Manages AI logs state and operations
- **`useKeyboardNavigation`**: Handles global keyboard shortcuts and vim-style navigation

#### Build Configuration
- **Build tool**: Vite (port 1420 for dev server, HMR on 1421)
- **TypeScript**: Strict mode enabled with bundler module resolution

### Backend (Rust + Tauri)
- **Entry point**: `src-tauri/src/main.rs` - calls `juli_lib::run()`
- **Core logic**: `src-tauri/src/lib.rs` - contains Tauri commands and app initialization
- **Library name**: `juli_lib` (note the `_lib` suffix required to avoid naming conflicts on Windows)
- **Key dependencies**:
  - `chrono` for date formatting
  - `tauri-plugin-opener` for opening URLs/files

### Tauri Command Pattern

Commands in `src-tauri/src/lib.rs` must be:
1. Decorated with `#[tauri::command]` attribute
2. Registered in the `invoke_handler` inside the `run()` function
3. Called from the frontend using the API service in `src/services/api.ts`

**Example flow**:
- API Service: `invoke<string>('get_formatted_date')` in `src/services/api.ts`
- Backend: `#[tauri::command] fn get_formatted_date() -> String { ... }`
- Registration: `.invoke_handler(tauri::generate_handler![get_formatted_date])`

## Key Implementation Notes

- Notes persistence is handled via the Rust backend database
- Date formatting is delegated to the Rust backend via the `get_formatted_date` command using the `chrono` crate
- Vite config is specifically tailored for Tauri (fixed ports, ignored src-tauri watching)
- The Rust library uses multiple crate types: staticlib, cdylib, and rlib for different build scenarios
- Frontend state management uses custom hooks for separation of concerns
- All backend API calls go through `src/services/api.ts` for centralized error handling
