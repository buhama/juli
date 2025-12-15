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
- **Entry point**: `src/main.tsx` - renders the React app into the DOM
- **Main component**: `src/App.tsx` - notes interface with localStorage persistence
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
3. Called from the frontend using `invoke<ReturnType>('command_name')`

**Example flow**:
- Frontend: `invoke<string>('get_formatted_date')`
- Backend: `#[tauri::command] fn get_formatted_date() -> String { ... }`
- Registration: `.invoke_handler(tauri::generate_handler![get_formatted_date])`

## Key Implementation Notes

- The app uses localStorage for notes persistence (handled entirely in the frontend)
- Date formatting is delegated to the Rust backend via the `get_formatted_date` command using the `chrono` crate
- Vite config is specifically tailored for Tauri (fixed ports, ignored src-tauri watching)
- The Rust library uses multiple crate types: staticlib, cdylib, and rlib for different build scenarios
