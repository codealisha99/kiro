import { request } from "./api";

export interface WorkProject {
  id: string; name: string; owner_id: string; updated_at: string;
  team_id?: string | null; restricted?: boolean;
  can_write?: boolean; can_manage_access?: boolean;
}
export interface WorkTask {
  id: string; project_id: string; title: string;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  assignee_id: string | null; remaining_hours: number | null;
  due_date: string | null; version: number;
}
export interface WorkInsight {
  id: string; project_id: string; task_id: string; title: string;
  rule: "OVERDUE" | "BLOCKED" | "UNASSIGNED"; detected_at: string;
  resolved_at: string | null; evidence_version: number;
  evidence_due_date: string | null; evidence_status: string;
  triage_status: "OPEN" | "ACKNOWLEDGED" | "DISMISSED";
  triage_reason: string | null; triage_version: number;
}
export interface WorkNotification { id: string; kind: "SCENARIO_APPROVAL_REQUESTED" | "SCENARIO_APPROVAL_DECIDED"; resource_id: string; created_at: string; read_at: string | null; project_name: string; }
export interface WorkOverview {
  metrics: {
    total_tasks: number; completed_tasks: number; blocked_tasks: number;
    overdue_tasks: number; unassigned_tasks: number; missing_estimates: number;
    estimated_remaining_hours: number; last_record_updated_at: string | null;
  };
  calculatedAt: string; scope: string; method: string; period: string;
  freshness: string; utilizationUnavailable: string;
}
export interface WorkDetail {
  project: WorkProject; tasks: WorkTask[]; members: { id: string; name: string | null }[]; viewer_id: string;
}
export interface WorkScenario {
  id: string; name: string; assessment: string; remaining_assumed_hours: number | null;
  period_start: string; period_end: string;
  method: string; limitations: string; known_remaining_hours: number; proposed_hours: number;
  available_hours: number; missing_estimates: number; undated_tasks: number;
  evidence: { task_id: string; task_version: number; remaining_hours: number | null; due_date: string | null }[];
  approval: { status: "NONE" | "PENDING" | "APPROVED" | "REJECTED"; requested_by?: string; reason?: string | null; version: number };
  outcome: { status: "NONE" | "IN_PROGRESS" | "DELIVERED" | "NOT_DELIVERED" | "CANCELLED"; actual_hours?: number | null; note?: string; version: number };
}
const path = (id: string) => `/work/projects/${encodeURIComponent(id)}`;
export const workApi = {
  overview: () => request<WorkOverview>("/work/overview"),
  projects: (offset = 0) => request<WorkProject[]>(`/work/projects?offset=${offset}`),
  createProject: (name: string) => request<WorkProject>("/work/projects", { method: "POST", body: { name } }),
  detail: (id: string, offset = 0) => request<WorkDetail>(`${path(id)}?offset=${offset}`),
  saveTask: (project: string, body: {
    title: string; status: WorkTask["status"]; assigneeId: string | null;
    remainingHours: number | null; dueDate: string | null; expectedVersion?: number;
  }, task?: string) => request<WorkTask>(`${path(project)}/tasks${task ? `/${encodeURIComponent(task)}` : ""}`, {
    method: task ? "PUT" : "POST", body,
  }),
  insights: (offset = 0) => request<WorkInsight[]>(`/work/insights?offset=${offset}`),
  triage: (id: string, status: WorkInsight["triage_status"], reason: string, expectedVersion: number) =>
    request(`/work/insights/${encodeURIComponent(id)}/triage`, { method: "POST", body: { status, reason, expectedVersion } }),
  grant: (project: string, userId: string, permission: string, revoke = false) =>
    request(`${path(project)}/${revoke ? "revoke" : "grants"}`, { method: "POST", body: { userId, permission } }),
  impact: (id: string) => request<WorkTask[]>(`/work/tasks/${encodeURIComponent(id)}/impact`),
  dependency: (id: string, dependsOnId: string, rationale: string) =>
    request(`/work/tasks/${encodeURIComponent(id)}/dependencies`, { method: "POST", body: { dependsOnId, rationale } }),
  history: (id: string) => request<{ id: string; kind: string; occurred_at: string; payload: string }[]>(`${path(id)}/history`),
  scenario: (id: string, body: { name: string; periodStart: string; periodEnd: string; availableHours: number; proposedHours: number; rationale: string }) =>
    request<WorkScenario>(`${path(id)}/scenarios`, { method: "POST", body }),
  scenarios: (id: string) => request<WorkScenario[]>(`${path(id)}/scenarios`),
  compareScenarios: (id: string, ids: string[]) =>
    request<WorkScenario[]>(`${path(id)}/scenarios/compare`, { method: "POST", body: { ids } }),
  scenarioResult: (id: string) => request<WorkScenario>(`/work/scenarios/${encodeURIComponent(id)}`),
  requestScenarioApproval: (id: string) => request<WorkScenario>(`/work/scenarios/${encodeURIComponent(id)}/approval`, { method: "POST" }),
  decideScenarioApproval: (id: string, status: "APPROVED" | "REJECTED", reason: string, expectedVersion: number) =>
    request<WorkScenario>(`/work/scenarios/${encodeURIComponent(id)}/approval/decision`, { method: "POST", body: { status, reason, expectedVersion } }),
  saveScenarioOutcome: (id: string, body: { status: "IN_PROGRESS" | "DELIVERED" | "NOT_DELIVERED" | "CANCELLED"; actualHours: number | null; note: string; expectedVersion: number }) =>
    request<WorkScenario>(`/work/scenarios/${encodeURIComponent(id)}/outcome`, { method: "PUT", body }),
  notifications: () => request<WorkNotification[]>("/work/notifications"),
  readNotification: (id: string) => request(`/work/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }),
};
