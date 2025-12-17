import type { DayNote, Reminder } from "../../lib/types";

interface TodayViewProps {
  currentDate: string;
  notes: DayNote | null;
  reminders: Reminder[];
  selectedReminderIndex: number | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onNotesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onResolveReminder: (reminderId: string) => void;
  onDeleteReminder: (reminderId: string) => void;
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
  if (dateStr === today) return 'today';
  if (dateStr < today) {
    const daysAgo = Math.floor((new Date(today).getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    return daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().split('T')[0]) return 'tomorrow';
  // Format as "Dec 20"
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TodayView({
  currentDate,
  notes,
  reminders,
  selectedReminderIndex,
  textareaRef,
  onNotesChange,
  onKeyDown,
  onResolveReminder,
  onDeleteReminder,
}: TodayViewProps) {
  const unresolvedReminders = reminders.filter(r => !r.resolved);

  return (
    <div className="today-view">
      <div className="date">{currentDate}</div>

      {unresolvedReminders.length > 0 && (
        <div className="unresolved-reminders">
          <div className="unresolved-reminders-title">Reminders</div>
          {unresolvedReminders.map((reminder, index) => {
            const dueToday = isToday(reminder.due_date);
            const overdue = isOverdue(reminder.due_date);

            return (
              <div
                key={reminder.id}
                className={`unresolved-reminder-item ${selectedReminderIndex === index ? 'selected' : ''}`}
              >
                <span className="unresolved-reminder-text">{reminder.text}</span>
                {reminder.due_date && (
                  <span className={`due-date-badge ${dueToday ? 'today' : ''} ${overdue ? 'overdue' : ''}`}>
                    {formatDueDate(reminder.due_date)}
                  </span>
                )}
                <button
                  className="mini-action-btn"
                  onClick={() => onResolveReminder(reminder.id)}
                >
                  resolve
                </button>
                <button
                  className="mini-action-btn delete"
                  onClick={() => onDeleteReminder(reminder.id)}
                >
                  delete
                </button>
              </div>
            );
          })}
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="notes-area"
        value={notes?.text || ''}
        onChange={onNotesChange}
        onKeyDown={onKeyDown}
        placeholder="Start typing..."
      />
    </div>
  );
}
