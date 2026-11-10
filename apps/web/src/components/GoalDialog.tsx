"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert, Badge, Button, Dialog, Field, Input, Textarea } from "@/components/ui";
import { homeApi, type Goal, type GoalDetail, type GoalStatus } from "@/lib/home-api";
import { CHECKIN_NOTE_MAX, goalToValues, toGoalUpdate, validateCheckin, type GoalFormValues } from "@/lib/goal-draft";
import { formatDay, formatNumber, HEALTH_LABELS, HEALTH_TONES, percentLabel, remainingLabel, SCOPE_TITLES, TASK_STATUS_LABELS } from "@/lib/goal-format";
import { GoalForm } from "./GoalForm";
import { GoalProgress } from "./GoalRow";

export interface GoalDialogProps {
  goalId: string | null;
  /** Visible goals, used for the alignment picker when editing. */
  goals: Goal[];
  onClose: () => void;
  onChanged: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function CheckinForm({ goal, busy, onSaved }: { goal: GoalDetail; busy: boolean; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ value?: string; note?: string }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateCheckin(goal.measure, value, note);
    setErrors(checked.errors);
    if (Object.values(checked.errors).some(Boolean)) return;
    setSaving(true); setSaveError(null);
    try {
      await homeApi.checkIn(goal.id, { value: checked.value, note: note.trim() });
      setValue(""); setNote("");
      onSaved();
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="goal-form" onSubmit={submit} noValidate aria-busy={saving}>
      {saveError && <Alert tone="danger">{saveError}</Alert>}
      {goal.measure === "METRIC" && (
        <Field label={`New value${goal.unit ? ` (${goal.unit})` : ""}`} hint="Updates the current value and progress." error={errors.value}>
          {(field) => <Input {...field} type="number" inputMode="decimal" step="any" value={value} disabled={busy || saving} onChange={(event) => setValue(event.target.value)} />}
        </Field>
      )}
      <Field label="Update note" hint={`What changed. Up to ${CHECKIN_NOTE_MAX} characters.`} error={errors.note}>
        {(field) => <Textarea {...field} rows={2} maxLength={CHECKIN_NOTE_MAX} value={note} disabled={busy || saving} onChange={(event) => setNote(event.target.value)} />}
      </Field>
      <div className="goal-form-actions">
        <Button variant="primary" type="submit" disabled={busy || saving}>{saving ? "Saving check-in…" : "Add check-in"}</Button>
      </div>
    </form>
  );
}

function GoalSummary({ goal }: { goal: GoalDetail }) {
  const remaining = remainingLabel(goal);
  return (
    <div className="goal-detail-summary">
      <p className="goal-detail-meta">
        <span>{SCOPE_TITLES[goal.scope]} · {goal.scopeName}</span>
        {goal.ownerName && <span>Owner {goal.ownerName}</span>}
        <Badge tone={HEALTH_TONES[goal.health]}>{HEALTH_LABELS[goal.health]}</Badge>
      </p>
      <GoalProgress progress={goal.progress} expected={goal.expected} />
      <dl className="goal-facts">
        <div><dt>Progress</dt><dd>{percentLabel(goal.progress)}</dd></div>
        {goal.measure === "METRIC" && goal.currentValue !== null && (
          <div><dt>Current</dt><dd>{formatNumber(goal.currentValue)}{goal.unit ? ` ${goal.unit}` : ""}</dd></div>
        )}
        {goal.measure === "METRIC" && goal.targetValue !== null && (
          <div><dt>Target</dt><dd>{formatNumber(goal.targetValue)}{goal.unit ? ` ${goal.unit}` : ""}</dd></div>
        )}
        {remaining && <div><dt>Distance</dt><dd>{remaining}</dd></div>}
        <div><dt>Due</dt><dd>{formatDay(goal.dueDate)}</dd></div>
      </dl>
      {goal.ancestors.length > 0 && (
        <p className="muted">Alignment chain: {goal.ancestors.map((ancestor) => ancestor.title).join(" › ")}</p>
      )}
      {goal.description && <p className="goal-detail-description">{goal.description}</p>}
    </div>
  );
}

function GoalLists({ goal }: { goal: GoalDetail }) {
  return (
    <>
      <section className="goal-detail-section" aria-labelledby="goal-checkins-title">
        <h3 id="goal-checkins-title">Check-ins</h3>
        {goal.checkins.length === 0 ? <p className="muted">No check-ins yet.</p> : (
          <ol className="goal-timeline">
            {goal.checkins.map((checkin) => (
              <li key={checkin.id}>
                <span className="goal-timeline-head">
                  {formatDay(checkin.created_at.slice(0, 10))} · {checkin.author_name}
                  {checkin.value !== null && <strong> → {formatNumber(checkin.value)}{goal.unit ? ` ${goal.unit}` : ""}</strong>}
                </span>
                <span>{checkin.note}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="goal-detail-section" aria-labelledby="goal-tasks-title">
        <h3 id="goal-tasks-title">Linked tasks</h3>
        {goal.tasks.length === 0 ? <p className="muted">No readable tasks are linked to this goal.</p> : (
          <ul className="goal-plain-list">
            {goal.tasks.map((task) => (
              <li key={task.id}><span>{task.title}</span><span className="muted">{TASK_STATUS_LABELS[task.status]}{task.project_name ? ` · ${task.project_name}` : ""}</span></li>
            ))}
          </ul>
        )}
      </section>
      <section className="goal-detail-section" aria-labelledby="goal-children-title">
        <h3 id="goal-children-title">Aligned goals</h3>
        {goal.children.length === 0 ? <p className="muted">No visible goals are aligned to this goal.</p> : (
          <ul className="goal-plain-list">
            {goal.children.map((child) => (
              <li key={child.id}><span>{child.title}</span><Badge tone={HEALTH_TONES[child.health]}>{HEALTH_LABELS[child.health]}</Badge></li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export function GoalDialog({ goalId, goals, onClose, onChanged }: GoalDialogProps) {
  const [goal, setGoal] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!goalId) return;
    let active = true;
    setLoading(true); setLoadError(null); setGoal(null); setEditing(false); setSaveError(null);
    homeApi.goal(goalId)
      .then((detail) => { if (active) setGoal(detail); })
      .catch((error: unknown) => { if (active) setLoadError(errorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [goalId]);

  async function reload() {
    if (!goalId) return;
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
      setSaveError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const canUpdate = goal ? goal.canEdit || goal.mine : false;
  const alignable = goals.filter((candidate) => candidate.id !== goalId);

  return (
    <Dialog open={goalId !== null} onClose={onClose} title={goal?.title ?? "Goal details"} className="goal-dialog">
      {loading && <p role="status">Loading goal…</p>}
      {loadError && <Alert tone="danger">{loadError}</Alert>}
      {goal && !editing && (
        <div className="goal-dialog-body">
          <GoalSummary goal={goal} />
          <div className="goal-dialog-actions">
            {goal.canEdit && <Button variant="secondary" onClick={() => setEditing(true)}>Edit goal</Button>}
          </div>
          {saveError && <Alert tone="danger">{saveError}</Alert>}
          <GoalLists goal={goal} />
          {canUpdate && (
            <section className="goal-detail-section" aria-labelledby="goal-checkin-form-title">
              <h3 id="goal-checkin-form-title">Add a check-in</h3>
              <CheckinForm goal={goal} busy={saving} onSaved={() => void reload()} />
            </section>
          )}
        </div>
      )}
      {goal && editing && (
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
      )}
    </Dialog>
  );
}
