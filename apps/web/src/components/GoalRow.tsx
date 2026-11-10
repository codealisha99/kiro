import { ProgressBar } from "@/components/charts";
import type { Goal } from "@/lib/home-api";
import { formatDay, HEALTH_LABELS, HEALTH_TONES, percentLabel, remainingLabel, SCOPE_TITLES } from "@/lib/goal-format";
import { HealthIcon } from "./StatusIcons";

/** Progress bar with the expected-by-today marker and the figures as text. */
export function GoalProgress({ progress, expected }: { progress: number | null; expected: number }) {
  const percent = Math.round((progress ?? 0) * 100);
  const expectedPercent = Math.round(expected * 100);
  const valueText = progress === null
    ? `No data yet. Expected ${expectedPercent}% by today.`
    : `${percent}% complete. Expected ${expectedPercent}% by today.`;
  return (
    <span className="goal-progress">
      <ProgressBar value={progress} expected={expected} label="Progress against expected" valueText={valueText} />
      <span className="goal-progress-value">{percentLabel(progress)}</span>
    </span>
  );
}

export function HealthLabel({ health }: { health: Goal["health"] }) {
  return (
    <span className={`goal-health tone-${HEALTH_TONES[health]}`}>
      <HealthIcon health={health} />
      <span>{HEALTH_LABELS[health]}</span>
    </span>
  );
}

export interface GoalRowProps {
  goal: Goal;
  parentTitle?: string | null;
  /** Nesting depth in the alignment tree. */
  depth?: number;
  selected?: boolean;
  /** A filtered-out ancestor kept only to give a matching goal its context. */
  context?: boolean;
  compact?: boolean;
  onOpen: () => void;
  /** Tree mode only: a toggle for rows with children, or null for a leaf that keeps the column aligned. */
  expandable?: { expanded: boolean; onToggle: () => void } | null;
}

function ownerScope(goal: Goal): string {
  const scope = SCOPE_TITLES[goal.scope];
  return goal.scopeName && goal.scopeName !== scope ? `${scope} · ${goal.scopeName}` : scope;
}

export function GoalRow({ goal, parentTitle, depth = 0, selected = false, context = false, compact = false, onOpen, expandable }: GoalRowProps) {
  const remaining = remainingLabel(goal);
  const classes = ["goal-row", goal.mine && "is-mine", selected && "is-selected", context && "is-context"].filter(Boolean).join(" ");
  return (
    <li className="goal-row-item" style={{ paddingLeft: depth * 20 }}>
      {expandable === null && <span className="goal-toggle-spacer" aria-hidden="true" />}
      {expandable && (
        <button
          type="button"
          className="goal-toggle"
          aria-expanded={expandable.expanded}
          aria-label={`${expandable.expanded ? "Collapse" : "Expand"} ${goal.title}`}
          onClick={expandable.onToggle}
        >
          <span aria-hidden="true">{expandable.expanded ? "▾" : "▸"}</span>
        </button>
      )}
      <button
        type="button"
        id={`goal-row-${goal.id}`}
        className={classes}
        aria-current={selected ? "true" : undefined}
        onClick={onOpen}
      >
        <span className="goal-row-head">
          <HealthLabel health={goal.health} />
          <span className="goal-row-title">{goal.title}</span>
          {goal.mine && <span className="goal-row-yours">Yours</span>}
        </span>
        {!compact && (
          <span className="goal-row-meta">
            <span>{ownerScope(goal)}</span>
            {goal.ownerName && goal.scope !== "PERSON" && <span>Owner {goal.ownerName}</span>}
            {parentTitle && <span className="goal-row-alignment">Aligned to {parentTitle}</span>}
          </span>
        )}
        <GoalProgress progress={goal.progress} expected={goal.expected} />
        <span className="goal-row-foot">
          {!compact && remaining && <span className="goal-row-remaining">{remaining}</span>}
          <span>Due {formatDay(goal.dueDate)}</span>
        </span>
      </button>
    </li>
  );
}
