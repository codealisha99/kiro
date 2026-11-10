import { Badge } from "@/components/ui";
import type { Goal } from "@/lib/home-api";
import { formatDay, HEALTH_LABELS, HEALTH_TONES, percentLabel, remainingLabel, SCOPE_TITLES } from "@/lib/goal-format";

export function GoalProgress({ progress, expected }: { progress: number | null; expected: number }) {
  const value = progress ?? 0;
  const percent = Math.round(value * 100);
  const expectedPercent = Math.round(expected * 100);
  const valueText = progress === null
    ? `No data yet. Expected ${expectedPercent}% by today.`
    : `${percent}% complete. Expected ${expectedPercent}% by today.`;
  return (
    <span className="goal-progress">
      <span
        className="goal-progress-track"
        role="progressbar"
        aria-label="Progress against expected"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress === null ? undefined : percent}
        aria-valuetext={valueText}
      >
        <span className="goal-progress-fill" style={{ width: `${value * 100}%` }} />
        <span className="goal-progress-expected" style={{ left: `${expected * 100}%` }} aria-hidden="true" />
      </span>
      <span className="goal-progress-text">
        <span className="goal-progress-value">{percentLabel(progress)}</span>
        <span>Expected by today {expectedPercent}%</span>
      </span>
    </span>
  );
}

export function GoalRow({
  goal,
  parentTitle,
  onOpen,
}: {
  goal: Goal;
  parentTitle?: string | null;
  onOpen?: () => void;
}) {
  const remaining = remainingLabel(goal);
  const content = (
    <>
      <span className="goal-row-head">
        <span className="goal-row-title">{goal.title}</span>
        <Badge tone={HEALTH_TONES[goal.health]}>{HEALTH_LABELS[goal.health]}</Badge>
      </span>
      <span className="goal-row-meta">
        <span>{goal.scopeName && goal.scopeName !== SCOPE_TITLES[goal.scope] ? `${SCOPE_TITLES[goal.scope]} · ${goal.scopeName}` : SCOPE_TITLES[goal.scope]}</span>
        {goal.ownerName && goal.scope !== "PERSON" && <span>Owner {goal.ownerName}</span>}
        {goal.mine && <Badge tone="info">Yours</Badge>}
      </span>
      <GoalProgress progress={goal.progress} expected={goal.expected} />
      <span className="goal-row-foot">
        {remaining && <span className="goal-row-remaining">{remaining}</span>}
        <span>Due {formatDay(goal.dueDate)}</span>
        {parentTitle && <span className="goal-row-alignment">Aligned to {parentTitle}</span>}
      </span>
    </>
  );
  const className = `goal-row${goal.mine ? " is-mine" : ""}`;
  if (!onOpen) {
    return <div className={className}>{content}</div>;
  }
  return (
    <button type="button" className={className} onClick={onOpen}>
      {content}
    </button>
  );
}
