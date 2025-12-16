import type { Reminder } from "../../lib/types";

interface RemindersViewProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showResolvedReminders: boolean;
  onToggleShowResolved: () => void;
  filteredUnresolvedReminders: Reminder[];
  filteredResolvedReminders: Reminder[];
  onResolveReminder: (reminderId: string) => void;
  onUnresolveReminder: (reminderId: string) => void;
  onDeleteReminder: (reminderId: string, isResolved?: boolean) => void;
}

export function RemindersView({
  searchQuery,
  onSearchChange,
  showResolvedReminders,
  onToggleShowResolved,
  filteredUnresolvedReminders,
  filteredResolvedReminders,
  onResolveReminder,
  onUnresolveReminder,
  onDeleteReminder,
}: RemindersViewProps) {
  return (
    <div className="reminders-view">
      <div className="reminders-header">
        <input
          type="text"
          className="search-input"
          placeholder="Search reminders..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button
          className={`toggle-resolved-btn ${showResolvedReminders ? 'active' : ''}`}
          onClick={onToggleShowResolved}
        >
          {showResolvedReminders ? 'hide resolved' : 'show resolved'}
        </button>
      </div>
      <div className="reminders-list">
        {filteredUnresolvedReminders.length > 0 ? (
          filteredUnresolvedReminders.map((reminder) => (
            <div key={reminder.id} className="reminder-card">
              <div className="reminder-header">
                <div className="reminder-content">
                  <div className="reminder-text">{reminder.text}</div>
                  {reminder.tags && (
                    <div className="reminder-tags">
                      {reminder.tags.split(',').map((tag, idx) => (
                        <span key={idx} className="reminder-tag">{tag.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="reminder-actions">
                  <button
                    className="action-btn"
                    onClick={() => onResolveReminder(reminder.id)}
                  >
                    resolve
                  </button>
                  <button
                    className="action-btn delete"
                    onClick={() => onDeleteReminder(reminder.id)}
                  >
                    delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-results">No unresolved reminders</div>
        )}

        {showResolvedReminders && (
          <>
            {filteredResolvedReminders.length > 0 && (
              <div className="resolved-section">
                <div className="resolved-divider">resolved</div>
                {filteredResolvedReminders.map((reminder) => (
                  <div key={reminder.id} className="reminder-card resolved">
                    <div className="reminder-header">
                      <div className="reminder-content">
                        <div className="reminder-text">{reminder.text}</div>
                        {reminder.tags && (
                          <div className="reminder-tags">
                            {reminder.tags.split(',').map((tag, idx) => (
                              <span key={idx} className="reminder-tag">{tag.trim()}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="reminder-actions">
                        <button
                          className="action-btn"
                          onClick={() => onUnresolveReminder(reminder.id)}
                        >
                          unresolve
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => onDeleteReminder(reminder.id, true)}
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {filteredResolvedReminders.length === 0 && (
              <div className="no-results">No resolved reminders</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
