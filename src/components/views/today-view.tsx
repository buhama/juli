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
          {unresolvedReminders.map((reminder, index) => (
            <div
              key={reminder.id}
              className={`unresolved-reminder-item ${selectedReminderIndex === index ? 'selected' : ''}`}
            >
              <span className="unresolved-reminder-text">{reminder.text}</span>
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
          ))}
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
