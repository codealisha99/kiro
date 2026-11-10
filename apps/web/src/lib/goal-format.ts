import type { DashboardView } from "./organization-api";
import type { Goal, GoalHealth, GoalMeasure, GoalScope, TaskStatus } from "./home-api";

export const SCOPE_ORDER: GoalScope[] = ["COMPANY", "DEPARTMENT", "TEAM", "PERSON"];
export const SCOPE_TITLES: Record<GoalScope, string> = {
  COMPANY: "Company",
  DEPARTMENT: "Department",
  TEAM: "Team",
  PERSON: "Personal",
};

export const HEALTH_LABELS: Record<GoalHealth, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
  ACHIEVED: "Achieved",
  NO_DATA: "No data",
  CANCELLED: "Cancelled",
};

export const HEALTH_TONES: Record<GoalHealth, "success" | "warning" | "danger" | "neutral"> = {
  ON_TRACK: "success",
  AT_RISK: "warning",
  OFF_TRACK: "danger",
  ACHIEVED: "success",
  NO_DATA: "neutral",
  CANCELLED: "neutral",
};

export const MEASURE_NAMES: Record<GoalMeasure, string> = { METRIC: "Metric", TASKS: "Linked tasks", CHILDREN: "Child goals" };

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

const SCOPE_VIEW_LABELS: Record<DashboardView, string> = {
  CEO: "Company view",
  VP: "Your reporting lines",
  DIRECTOR: "Your reporting lines",
  MANAGER: "Your reporting team",
  EMPLOYEE: "Your work",
};

export function scopeLabel(view: DashboardView): string {
  return SCOPE_VIEW_LABELS[view];
}

export interface GoalGroup { scope: GoalScope; title: string; goals: Goal[] }

/** Groups goals by scope in display order, omitting empty groups. */
export function groupGoalsByScope(goals: Goal[]): GoalGroup[] {
  return SCOPE_ORDER.map((scope) => ({
    scope,
    title: SCOPE_TITLES[scope],
    goals: goals.filter((goal) => goal.scope === scope),
  })).filter((group) => group.goals.length > 0);
}

export function percentLabel(progress: number | null): string {
  return progress === null ? "No data" : `${Math.round(progress * 100)}%`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Distance to target, or null when the goal has no remaining measure. */
export function remainingLabel(goal: Goal): string | null {
  if (goal.remaining === null) {
    return goal.measure === "CHILDREN" && goal.childCount > 0
      ? `${goal.childCount} aligned ${goal.childCount === 1 ? "goal" : "goals"}`
      : null;
  }
  if (goal.measure === "TASKS") {
    if (goal.remaining === 0) return "All linked tasks done";
    return `${formatNumber(goal.remaining)} ${goal.remaining === 1 ? "task" : "tasks"} open`;
  }
  if (goal.remaining <= 0) return "Target reached";
  const unit = goal.unit ? ` ${goal.unit}` : "";
  return `${formatNumber(goal.remaining)}${unit} to go`;
}

/** Parses a YYYY-MM-DD value as a local calendar date, avoiding UTC day shifts. */
export function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDay(iso: string): string {
  return parseDay(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function toIsoDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isOverdue(dueDate: string | null, status: TaskStatus, today: string): boolean {
  return status !== "DONE" && dueDate !== null && dueDate < today;
}

export const TASK_STATUS_TONES: Record<TaskStatus, "neutral" | "info" | "warning" | "danger" | "success"> = {
  TODO: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "danger",
  DONE: "success",
};
