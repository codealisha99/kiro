"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { homeApi, type Goal, type GoalDetail, type GoalStatus } from "@/lib/home-api";
import { goalToValues, toGoalUpdate, type GoalFormValues } from "@/lib/goal-draft";
import { formatDay, formatNumber, MEASURE_NAMES, percentLabel, remainingLabel, SCOPE_TITLES, TASK_STATUS_LABELS } from "@/lib/goal-format";
import { GoalChart } from "./GoalChart";
import { GoalCheckinForm } from "./GoalCheckinForm";
import { GoalForm } from "./GoalForm";
import { GoalProgress, HealthLabel } from "./GoalRow";

export interface GoalPanelProps {
  goalId: string;
  /** Visible goals, used for the alignment picker when editing. */
  goals: Goal[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onChanged: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function unitText(value: number | null, unit: string | null): string {
  if (value === null) return "Not set";
  return `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
}

function Properties({ goal, onSelect }: { goal: GoalDetail; onSelect: (id: string) => void }) {
  const parent = goal.ancestors[0];
  return (
    <dl className="goal-props">
      <div><dt>Health</dt><dd><HealthLabel health={goal.health} /></dd></div>
      <div><dt>Owner</dt><dd>{goal.ownerName ?? "Unassigned"}</dd></div>
      <div><dt>Scope</dt><dd>{SCOPE_TITLES[goal.scope]} · {goal.scopeName}</dd></div>
      <div><dt>Measure</dt><dd>{MEASURE_NAMES[goal.measure]}</dd></div>
      {goal.measure === "METRIC" && <div><dt>Current</dt><dd>{unitText(goal.currentValue, goal.unit)}</dd></div>}
      {goal.measure === "METRIC" && <div><dt>Target</dt><dd>{unitText(goal.targetValue, goal.unit)}</dd></div>}
      <div><dt>Start</dt><dd>{formatDay(goal.startDate)}</dd></div>
      <div><dt>Due</dt><dd>{formatDay(goal.dueDate)}</dd></div>
      <div>
        <dt>Parent</dt>
        <dd>{parent ? <button type="button" className="goal-link" onClick={() => onSelect(parent.id)}>{parent.title}</button> : "None"}</dd>
      </div>
    </dl>
  );
}

function GoalBody({ goal, onSelect, onCheckedIn, onEdit }: { goal: GoalDetail; onSelect: (id: string) => void; onCheckedIn: () => void; onEdit: () => void }) {
  const remaining = remainingLabel(goal);
  return (
    <div className="goal-panel-body">
      {goal.canEdit && (
        <div className="goal-panel-actions-row">
          <Button variant="secondary" size="small" onClick={onEdit}>Edit goal</Button>
        </div>
      )}
      <section className="goal-panel-section" aria-labelledby="goal-progress-title">
        <h3 id="goal-progress-title">Progress</h3>
        <GoalProgress progress={goal.progress} expected={goal.expected} />
        {remaining && <p className="goal-panel-figures">{remaining}</p>}
      </section>
      <Properties goal={goal} onSelect={onSelect} />
      {goal.description && <p className="goal-detail-description">{goal.description}</p>}
      <section className="goal-panel-section">
        <GoalChart goal={goal} />
      </section>
      {goal.canEdit && (
        <section className="goal-panel-section" aria-labelledby="goal-checkin-form-title">
          <h3 id="goal-checkin-form-title">Add a check-in</h3>
          <GoalCheckinForm goal={goal} onSaved={onCheckedIn} />
        </section>
      )}
      <section className="goal-panel-section" aria-labelledby="goal-checkins-title">
        <h3 id="goal-checkins-title">Check-in timeline</h3>
        {goal.checkins.length === 0 ? <p className="muted">No check-ins yet.</p> : (
          <ol className="goal-timeline">
            {goal.checkins.map((checkin) => (
              <li key={checkin.id}>
                <span className="goal-timeline-head">
                  {formatDay(checkin.created_at.slice(0, 10))} · {checkin.author_name}
                  {checkin.value !== null && <strong> → {unitText(checkin.value, goal.unit)}</strong>}
                </span>
                <span>{checkin.note}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="goal-panel-section" aria-labelledby="goal-tasks-title">
        <h3 id="goal-tasks-title">Linked tasks</h3>
        {goal.tasks.length === 0 ? <p className="muted">No readable tasks are linked to this goal.</p> : (
          <ul className="goal-plain-list">
            {goal.tasks.map((task) => (
              <li key={task.id}><span>{task.title}</span><span className="muted">{TASK_STATUS_LABELS[task.status]}{task.project_name ? ` · ${task.project_name}` : ""}</span></li>
            ))}
          </ul>
        )}
      </section>
      <section className="goal-panel-section" aria-labelledby="goal-children-title">
        <h3 id="goal-children-title">Aligned goals</h3>
        {goal.children.length === 0 ? <p className="muted">No visible goals are aligned to this goal.</p> : (
          <ul className="goal-plain-list">
            {goal.children.map((child) => (
              <li key={child.id}>
                <button type="button" className="goal-link" onClick={() => onSelect(child.id)}>{child.title}</button>
                <span className="goal-link-meta"><HealthLabel health={child.health} /><span>{percentLabel(child.progress)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function GoalPanel({ goalId, goals, onClose, onSelect, onChanged }: GoalPanelProps) {
  const [goal, setGoal] = useState<GoalDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  // On narrow screens the panel sits above the list, so bring it into view when a goal opens.
  useEffect(() => {
    if (window.matchMedia("(max-width: 1099px)").matches) panelRef.current?.scrollIntoView({ block: "start" });
  }, [goalId]);

  useEffect(() => {
    let active = true;
    setGoal(null); setLoadError(null); setEditing(false); setSaveError(null);
    homeApi.goal(goalId)
      .then((detail) => { if (active) setGoal(detail); })
      .catch((error: unknown) => { if (active) setLoadError(errorMessage(error)); });
    return () => { active = false; };
  }, [goalId]);

  async function reload() {
    try {
      setGoal(await homeApi.goal(goalId));
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
    onChanged();
  }

  async function saveEdit(values: GoalFormValues, status: GoalStatus) {
    if (!goal) return;
    setSaving(true); setSaveError(null);
    try {
      await homeApi.updateGoal(goal.id, toGoalUpdate(values, status, goal.version, goal.ownerId ?? ""));
      setEditing(false);
      await reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Someone else saved first: load their version so the next save uses the current version.
        setEditing(false);
        await reload();
        setSaveError("This goal changed while you were editing. Your edits were not saved. Review the latest values, then edit again.");
      } else {
        setSaveError(errorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  const alignable = goals.filter((candidate) => candidate.id !== goalId);

  return (
    <aside ref={panelRef} className="goal-panel" aria-labelledby="goal-panel-title">
      <header className="goal-panel-head">
        <div className="goal-panel-titles">
          {goal && <p className="goal-panel-eyebrow">{goal.scopeName && goal.scopeName !== SCOPE_TITLES[goal.scope] ? `${SCOPE_TITLES[goal.scope]} · ${goal.scopeName}` : SCOPE_TITLES[goal.scope]}</p>}
          <h2 id="goal-panel-title">{goal?.title ?? "Goal"}</h2>
        </div>
        <Button variant="secondary" size="small" onClick={onClose}>Close</Button>
      </header>
      {!goal && !loadError && <p role="status" className="muted">Loading goal…</p>}
      {loadError && <Alert tone="danger">{loadError}</Alert>}
      {goal && !editing && (
        <>
          {saveError && <Alert tone="danger">{saveError}</Alert>}
          <GoalBody goal={goal} onSelect={onSelect} onCheckedIn={() => void reload()} onEdit={() => { setSaveError(null); setEditing(true); }} />
        </>
      )}
      {goal && editing && (
        <div className="goal-panel-body">
          <GoalForm
            mode="edit"
            goal={goal}
            initial={goalToValues(goal)}
            initialStatus={goal.status}
            parents={alignable}
            busy={saving}
            serverError={saveError}
            onSubmit={(values, status) => void saveEdit(values, status)}
            onCancel={() => { setEditing(false); setSaveError(null); }}
          />
        </div>
      )}
    </aside>
  );
}
