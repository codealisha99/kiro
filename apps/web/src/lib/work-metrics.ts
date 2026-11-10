import type { WorkProject, WorkTask } from "./work-api";

// Pure calculations for the projects and tasks screen. Everything here is derived from loaded task records.
export type TaskStatus = WorkTask["status"];

export const STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];
export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export function todayIso(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

// Overdue means unfinished and due before today (UTC), matching the server's rule.
export function isOverdue(task: Pick<WorkTask, "status" | "due_date">, today: string): boolean {
  return task.status !== "DONE" && task.due_date !== null && task.due_date < today;
}

export function summarizeTasks(tasks: WorkTask[], today: string) {
  let done = 0;
  let blocked = 0;
  let overdue = 0;
  let unassigned = 0;
  let missingEstimates = 0;
  let remainingHours = 0;
  for (const task of tasks) {
    if (task.status === "DONE") {
      done += 1;
      continue;
    }
    if (task.status === "BLOCKED") blocked += 1;
    if (isOverdue(task, today)) overdue += 1;
    if (!task.assignee_id) unassigned += 1;
    if (task.remaining_hours === null) missingEstimates += 1;
    else remainingHours += Number(task.remaining_hours);
  }
  const total = tasks.length;
  return {
    total,
    done,
    open: total - done,
    blocked,
    overdue,
    unassigned,
    missingEstimates,
    remainingHours,
    progress: total === 0 ? null : done / total,
  };
}

export function groupByStatus(tasks: WorkTask[]) {
  return STATUS_ORDER.map((status) => ({ status, tasks: tasks.filter((task) => task.status === status) }));
}

// Keyboard order (top to bottom in the list, then left to right on the board).
export function taskOrder(tasks: WorkTask[]): string[] {
  return groupByStatus(tasks).flatMap((group) => group.tasks.map((task) => task.id));
}

export function openByAssignee(tasks: WorkTask[], nameOf: (id: string) => string) {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.status === "DONE") continue;
    const key = task.assignee_id ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([id, value]) => ({
      id: id || "unassigned",
      label: id ? nameOf(id) : "Unassigned",
      value,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

// Monday 00:00 UTC of the week containing the given time.
export function weekStartMs(ms: number): number {
  const date = new Date(ms);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday);
}

export function recentWeekStarts(nowMs: number, weeks = 8): number[] {
  const current = weekStartMs(nowMs);
  return Array.from({ length: weeks }, (_, index) => current - (weeks - 1 - index) * WEEK_MS);
}

export function completionsByWeek(tasks: WorkTask[], nowMs: number, weeks = 8) {
  const starts = recentWeekStarts(nowMs, weeks);
  const completed = tasks.flatMap((task) => (task.completed_at ? [Date.parse(task.completed_at)] : []));
  const values = starts.map((start) => completed.filter((at) => at >= start && at < start + WEEK_MS).length);
  return { starts, values };
}

// Open tasks at each week start plus now: created on or before the point and not completed by it.
export function openTasksOverTime(tasks: WorkTask[], nowMs: number, weeks = 8) {
  const times = [...recentWeekStarts(nowMs, weeks), nowMs];
  return times.map((x) => ({
    x,
    y: tasks.filter((task) => {
      const created = Date.parse(task.created_at);
      const completed = task.completed_at ? Date.parse(task.completed_at) : null;
      return created <= x && (completed === null || completed > x);
    }).length,
  }));
}

export function moveIndex(current: number, length: number, delta: 1 | -1): number {
  if (length === 0) return -1;
  if (current < 0) return delta > 0 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, current + delta));
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function parsePayload(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Summary for the project list, from the server's counts over all of the project's tasks.
type ProjectCounts = Pick<WorkProject, "updated_at" | "task_total" | "task_done" | "task_blocked" | "tasks_updated_at">;
export function projectSummary(project: ProjectCounts) {
  const total = Number(project.task_total ?? 0);
  const done = Number(project.task_done ?? 0);
  const updated = Math.max(Date.parse(project.tasks_updated_at ?? "") || 0, Date.parse(project.updated_at) || 0);
  return {
    total,
    done,
    blocked: Number(project.task_blocked ?? 0),
    progress: total === 0 ? null : done / total,
    updatedAt: updated ? new Date(updated).toISOString() : null,
  };
}

// Overview charts. Open excludes blocked tasks so the three segments add up to the total.
export function taskStatusSegments(m: { total_tasks: number; completed_tasks: number; blocked_tasks: number }) {
  const done = Number(m.completed_tasks);
  const blocked = Number(m.blocked_tasks);
  const open = Math.max(0, Number(m.total_tasks) - done - blocked);
  return [
    { id: "done", label: "Done", value: done, tone: "good" as const },
    { id: "open", label: "Open", value: open, tone: "accent" as const },
    { id: "blocked", label: "Blocked", value: blocked, tone: "danger" as const },
  ];
}

// Projects with tasks, most complete first, as whole percentages.
export function projectCompletion(projects: Pick<WorkProject, "id" | "name" | "updated_at" | "task_total" | "task_done" | "task_blocked" | "tasks_updated_at">[], limit = 8) {
  return projects
    .map((p) => ({ p, s: projectSummary(p) }))
    .filter(({ s }) => s.total > 0)
    .sort((a, b) => (b.s.progress ?? 0) - (a.s.progress ?? 0) || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map(({ p, s }) => ({
      id: p.id,
      label: p.name,
      value: Math.round((s.progress ?? 0) * 100),
      detail: `${s.done} of ${s.total} done${s.blocked ? `, ${s.blocked} blocked` : ""}`,
    }));
}
