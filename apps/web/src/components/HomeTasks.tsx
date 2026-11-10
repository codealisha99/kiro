"use client";

import { Button } from "@/components/ui";
import type { Goal, HomeTask } from "@/lib/home-api";
import { formatDay, isOverdue, TASK_STATUS_LABELS } from "@/lib/goal-format";
import { openView } from "@/lib/goal-nav";
import { TaskStatusIcon } from "./StatusIcons";

const PREVIEW_TASKS = 10;

export function HomeTasks({ tasks, goals, today }: { tasks: HomeTask[]; goals: Goal[]; today: string }) {
  const preview = tasks.slice(0, PREVIEW_TASKS);
  return (
    <section className="home-section" aria-labelledby="home-tasks-title">
      <div className="home-section-heading">
        <div>
          <h2 id="home-tasks-title">My tasks</h2>
          <p className="muted">Unfinished tasks assigned to you, earliest due date first.</p>
        </div>
        <Button variant="secondary" size="small" onClick={() => openView("work")}>Projects and tasks</Button>
      </div>
      {tasks.length === 0 ? (
        <p className="muted">No open tasks are assigned to you.</p>
      ) : (
        <>
          <ul className="home-task-list">
            {preview.map((task) => {
              const overdue = isOverdue(task.due_date, task.status, today);
              const linked = goals.filter((goal) => task.goalIds.includes(goal.id));
              return (
                <li key={task.id} className={`home-task${overdue ? " is-overdue" : ""}`}>
                  <TaskStatusIcon status={task.status} />
                  <span className="home-task-title">{task.title}</span>
                  <span className="home-task-status">{TASK_STATUS_LABELS[task.status]}</span>
                  {task.project_name && <span className="home-task-project">{task.project_name}</span>}
                  <span className={`home-task-due${overdue ? " is-overdue" : ""}`}>
                    {task.due_date ? (overdue ? `Overdue · ${formatDay(task.due_date)}` : formatDay(task.due_date)) : "No due date"}
                  </span>
                  {linked.length > 0 && (
                    <span className="home-chips">
                      {linked.map((goal) => <span key={goal.id} className="home-chip">{goal.title}</span>)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {tasks.length > PREVIEW_TASKS && (
            <p className="muted home-more">Showing {PREVIEW_TASKS} of {tasks.length} tasks.</p>
          )}
        </>
      )}
    </section>
  );
}
