import type { Goal, GoalDraft, GoalMeasure, GoalScope, GoalStatus, GoalUpdate } from "./home-api";

export const GOAL_TITLE_MAX = 200;
export const GOAL_DESCRIPTION_MAX = 2000;
export const GOAL_UNIT_MAX = 40;
export const CHECKIN_NOTE_MAX = 1000;

/** Form values stay as strings so partially typed numbers survive re-renders. */
export interface GoalFormValues {
  scope: GoalScope;
  departmentId: string;
  teamId: string;
  ownerId: string;
  parentId: string;
  title: string;
  description: string;
  measure: GoalMeasure;
  unit: string;
  startValue: string;
  targetValue: string;
  currentValue: string;
  startDate: string;
  dueDate: string;
}

export type GoalFormErrors = Partial<Record<keyof GoalFormValues, string>>;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function emptyGoalValues(scope: GoalScope, today: string): GoalFormValues {
  return {
    scope,
    departmentId: "",
    teamId: "",
    ownerId: "",
    parentId: "",
    title: "",
    description: "",
    measure: "METRIC",
    unit: "",
    startValue: "",
    targetValue: "",
    currentValue: "",
    startDate: today,
    dueDate: "",
  };
}

export function goalToValues(goal: Goal): GoalFormValues {
  return {
    scope: goal.scope,
    departmentId: goal.departmentId ?? "",
    teamId: goal.teamId ?? "",
    ownerId: goal.ownerId ?? "",
    parentId: goal.parentId ?? "",
    title: goal.title,
    description: goal.description ?? "",
    measure: goal.measure,
    unit: goal.unit ?? "",
    startValue: goal.startValue === null ? "" : String(goal.startValue),
    targetValue: goal.targetValue === null ? "" : String(goal.targetValue),
    currentValue: goal.currentValue === null ? "" : String(goal.currentValue),
    startDate: goal.startDate,
    dueDate: goal.dueDate,
  };
}

/** Returns a number, null for an empty field, or NaN when the text is not numeric. */
function parseOptionalNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return Number(trimmed);
}

function checkDay(value: string, label: string): string | undefined {
  if (!value) return `Choose a ${label.toLowerCase()}.`;
  if (!DAY_PATTERN.test(value)) return `Enter a valid ${label.toLowerCase()}.`;
  return undefined;
}

function checkNumber(text: string, label: string): string | undefined {
  const value = parseOptionalNumber(text);
  if (value === null) return `Enter the ${label.toLowerCase()}.`;
  if (!Number.isFinite(value)) return `${label} must be a number.`;
  return undefined;
}

function scopeErrors(values: GoalFormValues): GoalFormErrors {
  if (values.scope === "DEPARTMENT" && !values.departmentId) return { departmentId: "Choose a department." };
  if (values.scope === "TEAM" && !values.teamId) return { teamId: "Choose a team." };
  if (values.scope === "PERSON" && !values.ownerId) return { ownerId: "Choose the person this goal belongs to." };
  return {};
}

function metricErrors(values: GoalFormValues): GoalFormErrors {
  if (values.measure !== "METRIC") return {};
  const errors: GoalFormErrors = {};
  if (!values.unit.trim()) errors.unit = "Name the unit, such as signups or %.";
  else if (values.unit.trim().length > GOAL_UNIT_MAX) errors.unit = `Keep the unit to ${GOAL_UNIT_MAX} characters.`;
  const start = checkNumber(values.startValue, "Start value");
  const target = checkNumber(values.targetValue, "Target value");
  const current = checkNumber(values.currentValue, "Current value");
  if (start) errors.startValue = start;
  if (target) errors.targetValue = target;
  if (current) errors.currentValue = current;
  const startNumber = parseOptionalNumber(values.startValue);
  const targetNumber = parseOptionalNumber(values.targetValue);
  if (!start && !target && startNumber === targetNumber) {
    errors.targetValue = "The target must differ from the start value.";
  }
  return errors;
}

/** Client-side checks mirror the API rules; the server remains the authority. */
export function validateGoalValues(values: GoalFormValues): GoalFormErrors {
  const errors: GoalFormErrors = { ...scopeErrors(values), ...metricErrors(values) };
  const title = values.title.trim();
  if (!title) errors.title = "Give the goal a title.";
  else if (title.length > GOAL_TITLE_MAX) errors.title = `Keep the title to ${GOAL_TITLE_MAX} characters.`;
  if (values.description.length > GOAL_DESCRIPTION_MAX) errors.description = `Keep the description to ${GOAL_DESCRIPTION_MAX} characters.`;
  const startDate = checkDay(values.startDate, "start date");
  const dueDate = checkDay(values.dueDate, "due date");
  if (startDate) errors.startDate = startDate;
  if (dueDate) errors.dueDate = dueDate;
  if (!startDate && !dueDate && values.dueDate < values.startDate) errors.dueDate = "The due date must be on or after the start date.";
  return errors;
}

function measureFields(values: GoalFormValues) {
  if (values.measure !== "METRIC") {
    return { unit: null, startValue: null, targetValue: null, currentValue: null };
  }
  return {
    unit: values.unit.trim(),
    startValue: parseOptionalNumber(values.startValue),
    targetValue: parseOptionalNumber(values.targetValue),
    currentValue: parseOptionalNumber(values.currentValue),
  };
}

/**
 * Builds the create payload from validated values. The API requires an owner for every scope:
 * PERSON goals use the picked person, other scopes use `fallbackOwnerId` (the viewer on create,
 * the existing owner on edit).
 */
export function toGoalDraft(values: GoalFormValues, fallbackOwnerId: string): GoalDraft {
  const description = values.description.trim();
  return {
    scope: values.scope,
    departmentId: values.scope === "DEPARTMENT" ? values.departmentId : null,
    teamId: values.scope === "TEAM" ? values.teamId : null,
    ownerId: values.scope === "PERSON" ? values.ownerId : fallbackOwnerId,
    parentId: values.parentId || null,
    title: values.title.trim(),
    description: description || null,
    measure: values.measure,
    ...measureFields(values),
    startDate: values.startDate,
    dueDate: values.dueDate,
  };
}

/** Builds the update payload: the full goal shape plus the version guard. */
export function toGoalUpdate(values: GoalFormValues, status: GoalStatus, expectedVersion: number, ownerId: string): GoalUpdate {
  return { ...toGoalDraft(values, ownerId), expectedVersion, status };
}

/** Check-in requires a note; METRIC goals also need a numeric value. */
export function validateCheckin(measure: GoalMeasure, valueText: string, note: string): { value: number | null; errors: { value?: string; note?: string } } {
  const errors: { value?: string; note?: string } = {};
  const value = parseOptionalNumber(valueText);
  if (measure === "METRIC") {
    if (value === null) errors.value = "Enter the current value.";
    else if (!Number.isFinite(value)) errors.value = "The value must be a number.";
  }
  if (!note.trim()) errors.note = "Add a short note about this update.";
  else if (note.trim().length > CHECKIN_NOTE_MAX) errors.note = `Keep the note to ${CHECKIN_NOTE_MAX} characters.`;
  return { value: measure === "METRIC" && value !== null && Number.isFinite(value) ? value : null, errors };
}
