"use client";
import { Badge } from "@/components/ui";
import type { WorkDetail, WorkPlanningTask, WorkTask } from "@/lib/work-api";
import { STATUS_LABELS, groupByStatus, initials, isOverdue, type TaskStatus } from "@/lib/work-metrics";

export type Member = WorkDetail["members"][number];
export type PlannedTasks = Record<string, WorkPlanningTask>;
export const PRIORITY_LABEL: Record<WorkPlanningTask["priority"], string> = { LOW: "Low", NORMAL: "Normal", HIGH: "High", CRITICAL: "Critical" };

// Linear-style status glyphs. Decorative: the group or column heading carries the status name.
export function TaskStatusIcon({ status }: { status: TaskStatus }) {
  return (
    <svg className={`work-status-icon is-${status.toLowerCase()}`} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6" />
      {status === "IN_PROGRESS" && <path d="M8 2a6 6 0 0 1 0 12z" className="fill" />}
      {status === "BLOCKED" && <path d="M4.5 8h7" />}
      {status === "DONE" && <><circle cx="8" cy="8" r="6" className="fill" /><path d="M5 8.2l2 2 4-4.2" className="check" /></>}
    </svg>
  );
}

export function memberName(members: Member[], id: string | null): string {
  if (!id) return "Unassigned";
  const member = members.find((m) => m.id === id);
  if (!member) return "Access no longer granted";
  return member.name ?? member.id;
}

export function PriorityBadge({ planned }: { planned: WorkPlanningTask | undefined }) {
  if (!planned) return null;
  const tone = planned.priority === "CRITICAL" ? "danger" : planned.priority === "HIGH" ? "warning" : "neutral";
  return <Badge tone={tone}>{PRIORITY_LABEL[planned.priority]}</Badge>;
}

export function AssigneeAvatar({ name, assigned }: { name: string; assigned: boolean }) {
  return (
    <span className="work-avatar" title={name} aria-label={`Assignee: ${name}`}>
      {assigned ? initials(name) : "-"}
    </span>
  );
}

export function DueText({ task, today }: { task: WorkTask; today: string }) {
  if (!task.due_date) return <span className="work-muted">No due date</span>;
  return (
    <span>
      {isOverdue(task, today) && <span className="work-danger">Overdue · </span>}
      {task.due_date}
    </span>
  );
}

type ListProps = {
  tasks: WorkTask[];
  members: Member[];
  planned: PlannedTasks;
  today: string;
  selectedId: string | null;
  onOpen: (id: string) => void;
};

export function TaskList({ tasks, members, planned, today, selectedId, onOpen }: ListProps) {
  const groups = groupByStatus(tasks).filter((group) => group.tasks.length > 0);
  return (
    <div className="work-task-list" data-nav-scope="tasks">
      {groups.map((group) => (
        <section key={group.status} className={`work-task-group${group.status === "DONE" ? " is-done" : ""}`} aria-labelledby={`group-${group.status}`}>
          <h3 id={`group-${group.status}`}>
            {STATUS_LABELS[group.status]} <span className="work-count">{group.tasks.length}</span>
          </h3>
          <ul>
            {group.tasks.map((task) => {
              const name = memberName(members, task.assignee_id);
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    className={`work-task-row${selectedId === task.id ? " is-selected" : ""}`}
                    data-nav-row
                    data-row-id={task.id}
                    aria-current={selectedId === task.id ? "true" : undefined}
                    onClick={() => onOpen(task.id)}
                  >
                    <TaskStatusIcon status={task.status} />
                    <span className="work-task-title">{task.title}</span>
                    <span className="work-task-meta">
                      <PriorityBadge planned={planned[task.id]} />
                      <span className="work-task-due"><DueText task={task} today={today} /></span>
                      <AssigneeAvatar name={name} assigned={!!task.assignee_id} />
                      <span className="work-task-hours">{task.remaining_hours === null ? "No estimate" : `${task.remaining_hours} h`}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
