import type { StatusState } from "../lib/types";

interface StatusIndicatorProps {
  status: StatusState;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  if (!status.type) return null;

  return (
    <div className={`status-indicator ${status.type}`}>
      {status.type === 'saving' && (
        <>
          <span className="status-dot"></span>
          <span className="status-text">Saving...</span>
        </>
      )}
      {status.type === 'ai-running' && (
        <>
          <span className="status-dot"></span>
          <span className="status-text">AI analyzing...</span>
        </>
      )}
      {status.type === 'ai-success' && (
        <>
          <span className="status-icon">✓</span>
          <span className="status-text">
            {status.remindersCount === 1
              ? 'Added 1 reminder'
              : `Added ${status.remindersCount} reminders`}
          </span>
        </>
      )}
      {status.type === 'ai-no-action' && (
        <>
          <span className="status-icon">✓</span>
          <span className="status-text">Saved</span>
        </>
      )}
    </div>
  );
}
