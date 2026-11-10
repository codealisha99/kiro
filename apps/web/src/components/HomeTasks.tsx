import { Badge } from "@/components/ui";
import type { Goal, HomeTask } from "@/lib/home-api";
import { formatDay, isOverdue, TASK_STATUS_LABELS, TASK_STATUS_TONES } from "@/lib/goal-format";

export function HomeTasks({ tasks, goals, today }: { tasks: HomeTask[]; goals: Goal[]; today: string }) {
  return (
    <section className="home-section" aria-labelledby="home-tasks-title">
      <h2 id="home-tasks-title">My tasks</h2>
      {tasks.length === 0 ? (
        <p className="muted">No open tasks are assigned to you.</p>
      ) : (
        <ul className="home-list">
          {tasks.map((task) => {
            const overdue = isOverdue(task.due_date, task.status, today);
            const linked = goals.filter((goal) => task.goalIds.includes(goal.id));
            return (
              <li key={task.id} className={`home-task${overdue ? " is-overdue" : ""}`}>
                <span className="home-task-title">{task.title}</span>
                <span className="home-task-meta">
                  <Badge tone={TASK_STATUS_TONES[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
                  {task.project_name && <span>{task.project_name}</span>}
                  {task.due_date && (
                    <span className={overdue ? "home-overdue" : undefined}>
                      {overdue ? `Overdue, due ${formatDay(task.due_date)}` : `Due ${formatDay(task.due_date)}`}
                    </span>
                  )}
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
      )}
    </section>
  );
}
