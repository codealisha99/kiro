"use client";
import { AssigneeAvatar, DueText, PriorityBadge, memberName, type Member, type PlannedTasks } from "./TaskList";
import { STATUS_LABELS, groupByStatus } from "@/lib/work-metrics";
import type { WorkTask } from "@/lib/work-api";

type BoardProps = {
  tasks: WorkTask[];
  members: Member[];
  planned: PlannedTasks;
  today: string;
  selectedId: string | null;
  onOpen: (id: string) => void;
};

// Status columns in the same order as the list, so j and k move through the board left to right.
export function TaskBoard({ tasks, members, planned, today, selectedId, onOpen }: BoardProps) {
  return (
    <div className="work-board" data-nav-scope="tasks">
      {groupByStatus(tasks).map((group) => (
        <section key={group.status} className="work-board-column" aria-labelledby={`column-${group.status}`}>
          <h3 id={`column-${group.status}`}>
            {STATUS_LABELS[group.status]} <span className="work-count">{group.tasks.length}</span>
          </h3>
          {group.tasks.length === 0 ? <p className="work-muted">No tasks</p> : (
            <ul>
              {group.tasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className={`work-task-card${selectedId === task.id ? " is-selected" : ""}`}
                    data-nav-row
                    data-row-id={task.id}
                    aria-current={selectedId === task.id ? "true" : undefined}
                    onClick={() => onOpen(task.id)}
                  >
                    <span className="work-task-title">{task.title}</span>
                    <span className="work-card-meta">
                      <PriorityBadge planned={planned[task.id]} />
                      <DueText task={task} today={today} />
                      <AssigneeAvatar name={memberName(members, task.assignee_id)} assigned={!!task.assignee_id} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
