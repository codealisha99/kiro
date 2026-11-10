import type { GoalHealth, TaskStatus } from "@/lib/home-api";

// Status glyphs are drawn with currentColor so the tone comes from the surrounding status class.
// Each health and task state has its own shape, so the meaning survives without color.
const BASE = <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />;

export function HealthIcon({ health }: { health: GoalHealth }) {
  const glyph = {
    ON_TRACK: <circle cx="7" cy="7" r="5.25" fill="currentColor" />,
    AT_RISK: <>{BASE}<path d="M7 1.75 A5.25 5.25 0 0 1 7 12.25 Z" fill="currentColor" /></>,
    OFF_TRACK: <>{BASE}<path d="M4.9 4.9 L9.1 9.1 M9.1 4.9 L4.9 9.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
    ACHIEVED: <>{BASE}<path d="M4.4 7.2 L6.2 9 L9.6 5.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>,
    NO_DATA: <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />,
    CANCELLED: <>{BASE}<path d="M4.2 9.8 L9.8 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  }[health];
  return (
    <svg className="status-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      {glyph}
    </svg>
  );
}

export function TaskStatusIcon({ status }: { status: TaskStatus }) {
  const glyph = {
    TODO: BASE,
    IN_PROGRESS: <>{BASE}<path d="M7 1.75 A5.25 5.25 0 0 1 7 12.25 Z" fill="currentColor" /></>,
    BLOCKED: <>{BASE}<path d="M4.4 7 H9.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
    DONE: <>
      <circle cx="7" cy="7" r="5.25" fill="currentColor" />
      <path d="M4.4 7.2 L6.2 9 L9.6 5.3" fill="none" stroke="var(--color-panel)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>,
  }[status];
  return (
    <svg className={`status-icon task-status-${status.toLowerCase()}`} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      {glyph}
    </svg>
  );
}
