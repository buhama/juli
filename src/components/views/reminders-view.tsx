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

// Helper to get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// Helper to check if a date is today
function isToday(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return dateStr === getTodayDate();
}

// Helper to check if a date is overdue (before today)
function isOverdue(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return dateStr < getTodayDate();
}

// Helper to format due date for display
function formatDueDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const today = getTodayDate();
  if (dateStr === today) return 'Today';
  if (dateStr < today) {
    const daysAgo = Math.floor((new Date(today).getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    return daysAgo === 1 ? 'Yesterday' : `${daysAgo} days overdue`;
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
  // Format as "Dec 20, 2025"
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
          filteredUnresolvedReminders.map((reminder) => {
            const dueToday = isToday(reminder.due_date);
            const overdue = isOverdue(reminder.due_date);

            return (
              <div key={reminder.id} className={`reminder-card ${dueToday ? 'due-today' : ''} ${overdue ? 'overdue' : ''}`}>
                <div className="reminder-header">
                  <div className="reminder-content">
                    <div className="reminder-title-row">
                      {(dueToday || overdue) && (
                        <span className={`due-indicator ${overdue ? 'overdue' : 'today'}`}>
                          {overdue ? '!' : '*'}
                        </span>
                      )}
                      <div className="reminder-text">{reminder.text}</div>
                    </div>
                    <div className="reminder-meta">
                      {reminder.due_date && (
                        <span className={`reminder-due-date ${dueToday ? 'today' : ''} ${overdue ? 'overdue' : ''}`}>
                          Due: {formatDueDate(reminder.due_date)}
                        </span>
                      )}
                      {reminder.tags && (
                        <div className="reminder-tags">
                          {reminder.tags.split(',').map((tag, idx) => (
                            <span key={idx} className="reminder-tag">{tag.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
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
            );
          })
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
                        <div className="reminder-meta">
                          {reminder.due_date && (
                            <span className="reminder-due-date">
                              Due: {formatDueDate(reminder.due_date)}
                            </span>
                          )}
                          {reminder.tags && (
                            <div className="reminder-tags">
                              {reminder.tags.split(',').map((tag, idx) => (
                                <span key={idx} className="reminder-tag">{tag.trim()}</span>
                              ))}
                            </div>
                          )}
                        </div>
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
