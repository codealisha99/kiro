"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { Goal, GoalMeasure, GoalOptions, GoalScope, GoalStatus, NamedOption } from "@/lib/home-api";
import { GOAL_DESCRIPTION_MAX, GOAL_TITLE_MAX, validateGoalValues, type GoalFormErrors, type GoalFormValues } from "@/lib/goal-draft";
import { formatNumber, SCOPE_TITLES } from "@/lib/goal-format";

const MEASURE_LABELS: Record<GoalMeasure, string> = {
  METRIC: "Metric: a number moving toward a target",
  TASKS: "Linked tasks: progress as tasks finish",
  CHILDREN: "Child goals: average progress of aligned goals",
};
const MEASURE_NAMES: Record<GoalMeasure, string> = { METRIC: "Metric", TASKS: "Linked tasks", CHILDREN: "Child goals" };
const STATUS_LABELS: Record<GoalStatus, string> = { ACTIVE: "Active", ACHIEVED: "Achieved", CANCELLED: "Cancelled" };
const STATUSES: GoalStatus[] = ["ACTIVE", "ACHIEVED", "CANCELLED"];

export interface GoalFormProps {
  mode: "create" | "edit";
  initial: GoalFormValues;
  /** Scopes and pickers the viewer may use; required in create mode. */
  options?: GoalOptions;
  /** Goal being edited; its measure and current value are shown read-only. */
  goal?: Goal;
  initialStatus?: GoalStatus;
  parents: Goal[];
  busy: boolean;
  serverError: string | null;
  onSubmit: (values: GoalFormValues, status: GoalStatus) => void;
  onCancel: () => void;
}

function Picker({ label, value, options, error, onChange }: {
  label: string;
  value: string;
  options: NamedOption[];
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} error={error}>
      {(field) => (
        <Select {...field} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose…</option>
          {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </Select>
      )}
    </Field>
  );
}

function NumberField({ label, value, error, hint, onChange }: {
  label: string;
  value: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(field) => (
        <Input {...field} type="number" inputMode="decimal" step="any" value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </Field>
  );
}

function ReadOnly({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="goal-readonly">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScopeFields({ values, options, errors, set }: {
  values: GoalFormValues;
  options: GoalOptions;
  errors: GoalFormErrors;
  set: <K extends keyof GoalFormValues>(key: K, value: GoalFormValues[K]) => void;
}) {
  return (
    <>
      <Field label="Scope" hint="Where this goal sits in the organization.">
        {(field) => (
          <Select {...field} value={values.scope} onChange={(event) => set("scope", event.target.value as GoalScope)}>
            {options.scopes.map((scope) => <option key={scope} value={scope}>{SCOPE_TITLES[scope]}</option>)}
          </Select>
        )}
      </Field>
      {values.scope === "DEPARTMENT" && (
        <Picker label="Department" value={values.departmentId} options={options.departments} error={errors.departmentId} onChange={(value) => set("departmentId", value)} />
      )}
      {values.scope === "TEAM" && (
        <Picker label="Team" value={values.teamId} options={options.teams} error={errors.teamId} onChange={(value) => set("teamId", value)} />
      )}
      {values.scope === "PERSON" && (
        <Picker label="Person" value={values.ownerId} options={options.people} error={errors.ownerId} onChange={(value) => set("ownerId", value)} />
      )}
    </>
  );
}

function MeasureFields({ values, goal, errors, set }: {
  values: GoalFormValues;
  goal?: Goal;
  errors: GoalFormErrors;
  set: <K extends keyof GoalFormValues>(key: K, value: GoalFormValues[K]) => void;
}) {
  const metric = values.measure === "METRIC";
  return (
    <fieldset className="goal-fieldset">
      <legend>Progress</legend>
      {goal ? (
        <ReadOnly label="Measure" value={MEASURE_NAMES[goal.measure]} />
      ) : (
        <Field label="Measure">
          {(field) => (
            <Select {...field} value={values.measure} onChange={(event) => set("measure", event.target.value as GoalMeasure)}>
              {(Object.keys(MEASURE_LABELS) as GoalMeasure[]).map((measure) => <option key={measure} value={measure}>{MEASURE_LABELS[measure]}</option>)}
            </Select>
          )}
        </Field>
      )}
      {metric && (
        <div className="goal-grid">
          <Field label="Unit" hint="For example signups, hours or %." error={errors.unit}>
            {(field) => <Input {...field} value={values.unit} onChange={(event) => set("unit", event.target.value)} />}
          </Field>
          <NumberField label="Start value" value={values.startValue} error={errors.startValue} onChange={(value) => set("startValue", value)} />
          <NumberField label="Target value" value={values.targetValue} error={errors.targetValue} onChange={(value) => set("targetValue", value)} />
          {goal ? (
            <ReadOnly label="Current value" value={goal.currentValue === null ? "Not recorded" : formatNumber(goal.currentValue)} />
          ) : (
            <NumberField label="Current value" value={values.currentValue} error={errors.currentValue} hint="Where the metric stands today." onChange={(value) => set("currentValue", value)} />
          )}
        </div>
      )}
      {goal && <p className="muted">Record progress with a check-in. Measure and scope cannot change after creation.</p>}
    </fieldset>
  );
}

export function GoalForm({ mode, initial, options, goal, initialStatus = "ACTIVE", parents, busy, serverError, onSubmit, onCancel }: GoalFormProps) {
  const [values, setValues] = useState<GoalFormValues>(initial);
  const [status, setStatus] = useState<GoalStatus>(initialStatus);
  const [errors, setErrors] = useState<GoalFormErrors>({});
  const set = <K extends keyof GoalFormValues>(key: K, value: GoalFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateGoalValues(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    onSubmit(values, status);
  }

  return (
    <form className="goal-form" onSubmit={submit} noValidate aria-busy={busy}>
      {serverError && <Alert tone="danger">{serverError}</Alert>}
      {mode === "create" && options && <ScopeFields values={values} options={options} errors={errors} set={set} />}
      <Field label="Goal title" hint={`Up to ${GOAL_TITLE_MAX} characters.`} error={errors.title}>
        {(field) => <Input {...field} value={values.title} maxLength={GOAL_TITLE_MAX} onChange={(event) => set("title", event.target.value)} />}
      </Field>
      <Field label="Description" hint="Optional. What success looks like." error={errors.description}>
        {(field) => <Textarea {...field} rows={3} value={values.description} maxLength={GOAL_DESCRIPTION_MAX} onChange={(event) => set("description", event.target.value)} />}
      </Field>
      <Field label="Aligned to" hint="Optional parent goal you can see.">
        {(field) => (
          <Select {...field} value={values.parentId} onChange={(event) => set("parentId", event.target.value)}>
            <option value="">No parent goal</option>
            {parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.title}</option>)}
          </Select>
        )}
      </Field>
      <MeasureFields values={values} goal={goal} errors={errors} set={set} />
      <div className="goal-grid">
        <Field label="Start date" error={errors.startDate}>
          {(field) => <Input {...field} type="date" value={values.startDate} onChange={(event) => set("startDate", event.target.value)} />}
        </Field>
        <Field label="Due date" error={errors.dueDate}>
          {(field) => <Input {...field} type="date" value={values.dueDate} onChange={(event) => set("dueDate", event.target.value)} />}
        </Field>
      </div>
      {mode === "edit" && (
        <Field label="Status">
          {(field) => (
            <Select {...field} value={status} onChange={(event) => setStatus(event.target.value as GoalStatus)}>
              {STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABELS[item]}</option>)}
            </Select>
          )}
        </Field>
      )}
      <div className="goal-form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Saving…" : mode === "create" ? "Create goal" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
