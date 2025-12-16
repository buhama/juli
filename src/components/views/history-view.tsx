import type { DayNote } from "../../lib/types";

interface HistoryViewProps {
  pastDays: DayNote[];
}

export function HistoryView({ pastDays }: HistoryViewProps) {
  return (
    <div className="history-view">
      <div className="history-list">
        {pastDays.map((day, index) => (
          <div key={index} className="history-card">
            <div className="history-date">{day.for_date}</div>
            <div className="history-content">{day.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
