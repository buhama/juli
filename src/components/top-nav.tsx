import type { View } from "../lib/types";

interface TopNavProps {
  currentView: View;
  onViewSwitch: (view: View) => void;
  onPrintTable: () => void;
  onGetApiKey: () => void;
  onReload: () => void;
}

export function TopNav({
  currentView,
  onViewSwitch,
  onPrintTable,
  onGetApiKey,
  onReload,
}: TopNavProps) {
  return (
    <nav className="top-nav">
      <button
        className={`nav-link ${currentView === 'today' ? 'active' : ''}`}
        onClick={() => onViewSwitch('today')}
      >
        Today
      </button>
      <button
        className={`nav-link ${currentView === 'history' ? 'active' : ''}`}
        onClick={() => onViewSwitch('history')}
      >
        History
      </button>
      <button
        className={`nav-link ${currentView === 'reminders' ? 'active' : ''}`}
        onClick={() => onViewSwitch('reminders')}
      >
        Reminders
      </button>
      <button
        className={`nav-link ${currentView === 'ai-logs' ? 'active' : ''}`}
        onClick={() => onViewSwitch('ai-logs')}
      >
        AI Logs
      </button>
      <button
        className="nav-link"
        onClick={onPrintTable}
        style={{ marginLeft: 'auto' }}
      >
        Print DB
      </button>
      <button
        className="nav-link"
        onClick={onGetApiKey}
        style={{ marginLeft: 'auto' }}
      >
        Get API Key
      </button>
      <button
        className="nav-link"
        onClick={onReload}
      >
        Reload
      </button>
    </nav>
  );
}
