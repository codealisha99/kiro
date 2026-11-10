"use client";
import { useState } from "react";
import { Button, Field, Input, Section, Select } from "@/components/ui";
import { workApi, type WorkDetail } from "@/lib/work-api";
import { TaskBoard } from "./TaskBoard";
import { TaskList, type PlannedTasks } from "./TaskList";
import { useAction } from "./use-action";

const PAGE = 100;

export function ProjectTasks({ detail, planned, today, canWrite, selectedId, offset, onOpen, onPage }: {
  detail: WorkDetail;
  planned: PlannedTasks;
  today: string;
  canWrite: boolean;
  selectedId: string | null;
  offset: number;
  onOpen: (id: string) => void;
  onPage: (offset: number) => Promise<void>;
}) {
  const [view, setView] = useState<"list" | "board">("list");
  const [dependency, setDependency] = useState({ task: "", target: "", rationale: "" });
  const { busy, error, run } = useAction();
  const tasks = detail.tasks;
  const layoutProps = { tasks, members: detail.members, planned, today, selectedId, onOpen };

  return (
    <Section
      title="Tasks"
      description="Grouped by status. j and k move between tasks, Enter opens one, c creates one."
      actions={<div className="work-segment" role="group" aria-label="Task layout">
        <Button variant="secondary" size="small" aria-pressed={view === "list"} onClick={() => setView("list")}>List</Button>
        <Button variant="secondary" size="small" aria-pressed={view === "board"} onClick={() => setView("board")}>Board</Button>
      </div>}
    >
      {error && <p role="alert" className="work-danger">{error}</p>}
      {!tasks.length && <p>No tasks on this page.{canWrite ? " Create one with New task or c." : ""}</p>}
      {tasks.length > 0 && (view === "list" ? <TaskList {...layoutProps} /> : <TaskBoard {...layoutProps} />)}
      <div className="work-actions">
        <Button variant="secondary" disabled={busy || !offset} onClick={() => void run(() => onPage(offset - PAGE))}>Previous tasks</Button>
        <Button variant="secondary" disabled={busy || tasks.length < PAGE} onClick={() => void run(() => onPage(offset + PAGE))}>Next tasks</Button>
      </div>
      {canWrite && (
        <details className="work-disclosure">
          <summary>Record a dependency</summary>
          <form className="work-form" onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await workApi.dependency(dependency.task, dependency.target, dependency.rationale);
              setDependency({ task: "", target: "", rationale: "" });
              await onPage(offset);
            });
          }}>
            <Field label="Dependent task">{(f) => (
              <Select {...f} required value={dependency.task} onChange={(e) => setDependency({ ...dependency, task: e.target.value })}>
                <option value="">Choose a task</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
            )}</Field>
            <Field label="Prerequisite task">{(f) => (
              <Select {...f} required value={dependency.target} onChange={(e) => setDependency({ ...dependency, target: e.target.value })}>
                <option value="">Choose a task</option>{tasks.filter((t) => t.id !== dependency.task).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
            )}</Field>
            <Field label="Reason">{(f) => <Input {...f} required maxLength={1000} value={dependency.rationale} onChange={(e) => setDependency({ ...dependency, rationale: e.target.value })} />}</Field>
            <Button type="submit" disabled={busy}>Save dependency</Button>
          </form>
        </details>
      )}
    </Section>
  );
}
