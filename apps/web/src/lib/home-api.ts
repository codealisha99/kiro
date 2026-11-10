import { request } from "./api";
import type { DashboardView, DataRow } from "./organization-api";

export type GoalScope = "COMPANY" | "DEPARTMENT" | "TEAM" | "PERSON";
export type GoalMeasure = "METRIC" | "TASKS" | "CHILDREN";
export type GoalStatus = "ACTIVE" | "ACHIEVED" | "CANCELLED";
export type GoalHealth = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED" | "NO_DATA" | "CANCELLED";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";

export interface NamedOption { id: string; name: string }

export interface Goal {
  id: string;
  scope: GoalScope;
  scopeName: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  departmentId: string | null;
  teamId: string | null;
  parentId: string | null;
  measure: GoalMeasure;
  unit: string | null;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  startDate: string;
  dueDate: string;
  status: GoalStatus;
  /** 0 to 1, or null when there is no data. */
  progress: number | null;
  /** Expected progress by today, 0 to 1. */
  expected: number;
  health: GoalHealth;
  /** Target minus current for METRIC goals, or open linked tasks for TASKS goals. */
  remaining: number | null;
  taskCount: number;
  doneTaskCount: number;
  childCount: number;
  canEdit: boolean;
  mine: boolean;
  version: number;
}

/** Task rows use the API's snake_case keys. */
export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  assignee_id?: string | null;
  due_date: string | null;
  project_name: string | null;
}
export interface HomeTask extends TaskSummary {
  remaining_hours: number | null;
  goalIds: string[];
}

export interface TeamPerson {
  id: string;
  name: string;
  open_tasks: number;
  in_progress: number;
  blocked: number;
  overdue: number;
  currentTasks: TaskSummary[];
}

export interface HomeResponse {
  me: { id: string; name: string; primaryView: DashboardView; views: DashboardView[]; teams: DataRow[]; reportCount: number };
  goals: Goal[];
  myTasks: HomeTask[];
  team: { basis: "REPORTS" | "TEAMMATES"; people: TeamPerson[] };
  scopeSummary: { view: DashboardView; metrics: DataRow };
  generatedAt: string;
  method: string;
}

export interface GoalCheckin {
  id: string;
  author_id: string;
  author_name: string;
  value: number | null;
  note: string;
  created_at: string;
}
export interface GoalDetail extends Goal {
  checkins: GoalCheckin[];
  tasks: TaskSummary[];
  children: Goal[];
  /** Nearest parent first; the chain stops at the first goal the viewer cannot read. */
  ancestors: Goal[];
}

export interface GoalOptions {
  scopes: GoalScope[];
  departments: NamedOption[];
  teams: NamedOption[];
  people: NamedOption[];
}

export interface GoalDraft {
  scope: GoalScope;
  departmentId: string | null;
  teamId: string | null;
  ownerId: string | null;
  parentId: string | null;
  title: string;
  description: string | null;
  measure: GoalMeasure;
  unit: string | null;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  startDate: string;
  dueDate: string;
}

/** Updates reuse the full create shape, plus the version guard and status. */
export interface GoalUpdate extends GoalDraft {
  expectedVersion: number;
  status: GoalStatus;
}

export interface GoalCheckinDraft { value: number | null; note: string }

/** Weekly completions from the organization metrics endpoint, oldest week first. */
export interface ThroughputResponse {
  weeks: number;
  weekly: { week_start: string; completed: number }[];
  summary: { open_tasks: number; blocked: number; overdue: number; completed_window: number };
  method: string;
}

const goalPath = (id: string) => `/goals/${encodeURIComponent(id)}`;

export const homeApi = {
  home: () => request<HomeResponse>("/home"),
  throughput: (weeks = 8) => request<ThroughputResponse>(`/organization/metrics?weeks=${weeks}`),
  goals: () => request<Goal[]>("/goals"),
  goalOptions: () => request<GoalOptions>("/goals/options"),
  goal: (id: string) => request<GoalDetail>(goalPath(id)),
  createGoal: (body: GoalDraft) => request<Goal>("/goals", { method: "POST", body }),
  updateGoal: (id: string, body: GoalUpdate) => request<Goal>(goalPath(id), { method: "PUT", body }),
  checkIn: (id: string, body: GoalCheckinDraft) => request<Goal>(`${goalPath(id)}/checkins`, { method: "POST", body }),
  linkTask: (id: string, body: { taskId: string; unlink: boolean }) =>
    request<GoalDetail>(`${goalPath(id)}/tasks`, { method: "POST", body }),
};
