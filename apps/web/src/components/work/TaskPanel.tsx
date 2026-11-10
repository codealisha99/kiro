"use client";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { workApi, type WorkPlanningTask, type WorkTask } from "@/lib/work-api";
import { STATUS_LABELS, isOverdue, parsePayload } from "@/lib/work-metrics";
import { TaskForm } from "./TaskForm";
import { AssigneeAvatar, PRIORITY_LABEL, TaskStatusIcon, memberName, type Member } from "./TaskList";
import { formatWhen } from "./format";
import { useAction } from "./use-action";

type HistoryEvent = Awaited<ReturnType<typeof workApi.history>>[number];

// Side panel for one task (edit) or a new task (create). Keyed by the parent so local state resets per task.
export function TaskPanel({ projectId, mode, task, members, canWrite, planned, today, onClose, onReload, onOpen }: {
  projectId: string;
  mode: "create" | "edit";
  task: WorkTask | null;
  members: Member[];
  canWrite: boolean;
  planned: WorkPlanningTask | undefined;
  today: string;
  onClose: () => void;
  onReload: () => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const [impact, setImpact] = useState<WorkTask[] | null>(null);
  const [history, setHistory] = useState<HistoryEvent[] | null>(null);
  const { busy, error, run } = useAction();
  const isEdit = mode === "edit" && task !== null;

  async function saved(next: WorkTask) {
    await onReload();
    if (!isEdit) {
      onOpen(next.id);
    }
  }

  return (
    <aside className="work-task-panel" aria-labelledby="task-panel-title" tabIndex={-1}>
      <header className="work-panel-head">
        <div>
          <p className="work-eyebrow">{isEdit ? "Task" : "New task"}</p>
          <h3 id="task-panel-title" tabIndex={-1}>{isEdit ? task.title : "Add a task"}</h3>
        </div>
        <Button variant="secondary" size="small" onClick={onClose}>Close</Button>
      </header>
      {isEdit && (
        <>
          <dl className="work-props">
            <div><dt>Status</dt><dd><span className="work-status-line"><TaskStatusIcon status={task.status} />{STATUS_LABELS[task.status]}</span></dd></div>
            <div><dt>Assignee</dt><dd><span className="work-status-line"><AssigneeAvatar name={memberName(members, task.assignee_id)} assigned={!!task.assignee_id} />{memberName(members, task.assignee_id)}</span></dd></div>
            <div><dt>Due</dt><dd>{task.due_date ?? "Not set"} {isOverdue(task, today) && <Badge tone="danger">Overdue</Badge>}</dd></div>
            <div><dt>Remaining estimate</dt><dd>{task.remaining_hours === null ? "Unknown" : `${task.remaining_hours} hours`}</dd></div>
            <div><dt>Priority</dt><dd>{planned ? PRIORITY_LABEL[planned.priority] : "Not planned"}</dd></div>
            <div><dt>Created</dt><dd>{formatWhen(task.created_at)}</dd></div>
            <div><dt>Last updated</dt><dd>{formatWhen(task.updated_at)}</dd></div>
            <div><dt>Version</dt><dd>{task.version}</dd></div>
          </dl>
          <p className="work-muted">Priority and milestones are set in the Planning tab.</p>
        </>
      )}
      {canWrite ? (
        <section className="work-panel-section">
          <h4>{isEdit ? "Edit task" : "Task details"}</h4>
          <TaskForm
            key={isEdit ? `${task.id}-${task.version}` : "new"}
            projectId={projectId}
            task={isEdit ? task : null}
            members={members}
            onSaved={saved}
            onReload={onReload}
          />
        </section>
      ) : (
        <p>Read-only project access.</p>
      )}
      {isEdit && (
        <>
          <section className="work-panel-section">
            <h4>Dependencies and impact</h4>
            <p>Downstream tasks that depend on this one, within your current access. Up to 100 tasks. Hidden relationships are excluded. This is a relationship query, not a delivery forecast.</p>
            <Button variant="secondary" disabled={busy} onClick={() => void run(async () => setImpact(await workApi.impact(task.id)))}>Explore impact</Button>
            {impact && (impact.length ? <ul className="work-plain-list">{impact.map((t) => <li key={t.id}>{t.title} — {STATUS_LABELS[t.status]}</li>)}</ul> : <p>No accessible downstream dependencies recorded.</p>)}
          </section>
          <section className="work-panel-section">
            <h4>Task history</h4>
            <p>Recorded changes to this task, from the latest 100 project events.</p>
            <Button variant="secondary" disabled={busy} onClick={() => void run(async () => {
              const events = await workApi.history(projectId);
              setHistory(events.filter((e) => e.task_id === task.id));
            })}>Load task history</Button>
            {history && (history.length ? (
              <ul className="work-plain-list">
                {history.map((e) => {
                  const payload = parsePayload(e.payload);
                  return (
                    <li key={e.id}>
                      <strong>{e.kind.replaceAll("_", " ").toLowerCase()}</strong>
                      <span className="work-muted"> · {formatWhen(e.occurred_at)}</span>
                      {payload && typeof payload.status === "string" && <p>Status: {STATUS_LABELS[payload.status as WorkTask["status"]] ?? payload.status}{typeof payload.version === "number" ? ` · version ${payload.version}` : ""}</p>}
                    </li>
                  );
                })}
              </ul>
            ) : <p>No recorded changes for this task.</p>)}
          </section>
        </>
      )}
      {error && <p role="alert" className="work-danger">{error}</p>}
    </aside>
  );
}
