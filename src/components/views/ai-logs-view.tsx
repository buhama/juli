import type { AiLog } from "../../lib/types";

interface AiLogsViewProps {
  aiLogs: AiLog[];
  onDeleteAiLog: (logId: number) => void;
  onDeleteAllAiLogs: () => void;
}

export function AiLogsView({
  aiLogs,
  onDeleteAiLog,
  onDeleteAllAiLogs,
}: AiLogsViewProps) {
  return (
    <div className="ai-logs-view">
      <div className="ai-logs-header">
        <button
          className="action-btn delete"
          onClick={onDeleteAllAiLogs}
          disabled={aiLogs.length === 0}
        >
          Delete All
        </button>
      </div>
      <div className="ai-logs-list">
        {aiLogs.length > 0 ? (
          aiLogs.map((log) => (
            <details key={log.id} className={`ai-log-card ${log.success ? 'success' : 'error'}`}>
              <summary className="ai-log-summary">
                <div className="log-header">
                  <div className="log-header-left">
                    <span className={`status-badge ${log.success ? 'success' : 'error'}`}>
                      {log.success ? '✓ Success' : '✗ Failed'}
                    </span>
                    <span className="log-date">{log.created_at}</span>
                  </div>
                  <button
                    className="action-btn delete"
                    onClick={(e) => {
                      e.preventDefault();
                      onDeleteAiLog(log.id);
                    }}
                  >
                    delete
                  </button>
                </div>
                <div className="log-info">
                  <span className="log-note-id">Note #{log.note_id}</span>
                  <span className="log-count">{log.reminders_count} reminder{log.reminders_count !== 1 ? 's' : ''}</span>
                </div>
                {log.reasoning && (
                  <div className="log-reasoning">{log.reasoning}</div>
                )}
              </summary>
              <div className="ai-log-details">
                <div className="detail-section">
                  <h4>Prompt</h4>
                  <pre className="detail-content">{log.prompt}</pre>
                </div>
                <div className="detail-section">
                  <h4>Response</h4>
                  <pre className="detail-content">{log.response}</pre>
                </div>
              </div>
            </details>
          ))
        ) : (
          <div className="no-results">No AI logs found</div>
        )}
      </div>
    </div>
  );
}
