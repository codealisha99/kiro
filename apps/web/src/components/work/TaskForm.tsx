"use client";
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { workApi, type WorkTask } from "@/lib/work-api";
import { errorMessage } from "./use-action";
import type { Member } from "./TaskList";

type Draft = { title: string; status: WorkTask["status"]; assigneeId: string; remainingHours: string; dueDate: string };

function draftFrom(task: WorkTask | null): Draft {
  if (!task) return { title: "", status: "TODO", assigneeId: "", remainingHours: "", dueDate: "" };
  return {
    title: task.title,
    status: task.status,
    assigneeId: task.assignee_id ?? "",
    remainingHours: task.remaining_hours === null ? "" : String(task.remaining_hours),
    dueDate: task.due_date ?? "",
  };
}

// Create or edit a task. Edits send the loaded version; a 409 means someone else saved first.
// The parent keys this form by task version, so a reload resets the draft to the latest values.
export function TaskForm({ projectId, task, members, onSaved, onReload }: {
  projectId: string;
  task: WorkTask | null;
  members: Member[];
  onSaved: (saved: WorkTask) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => draftFrom(task));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setConflict(false);
    try {
      const saved = await workApi.saveTask(projectId, {
        title: draft.title.trim(),
        status: draft.status,
        assigneeId: draft.assigneeId || null,
        remainingHours: draft.remainingHours === "" ? null : Number(draft.remainingHours),
        dueDate: draft.dueDate || null,
        expectedVersion: task?.version,
      }, task?.id);
      await onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setConflict(true);
      else setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="work-form" onSubmit={(e) => void save(e)} aria-label={task ? "Edit task" : "New task"}>
      {conflict && (
        <Alert tone="danger">
          <p>This task changed after you opened it, so your save was not applied. Reload the latest version, then make your changes again. Reloading discards the edits here.</p>
          <Button variant="secondary" size="small" onClick={() => void onReload()}>Reload latest version</Button>
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Task title">{(f) => <Input {...f} required maxLength={200} disabled={saving} value={draft.title} onChange={(e) => update({ title: e.target.value })} />}</Field>
      <Field label="Status">{(f) => (
        <Select {...f} disabled={saving} value={draft.status} onChange={(e) => update({ status: e.target.value as WorkTask["status"] })}>
          {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const).map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
        </Select>
      )}</Field>
      <Field label="Assignee">{(f) => (
        <Select {...f} disabled={saving} value={draft.assigneeId} onChange={(e) => update({ assigneeId: e.target.value })}>
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name ?? m.id}</option>)}
        </Select>
      )}</Field>
      <Field label="Remaining effort (estimated hours)" hint="Leave blank if unknown.">{(f) => (
        <Input {...f} disabled={saving} type="number" min="0" max="100000" step="0.01" value={draft.remainingHours} onChange={(e) => update({ remainingHours: e.target.value })} />
      )}</Field>
      <Field label="Due date (UTC)">{(f) => <Input {...f} disabled={saving} type="date" value={draft.dueDate} onChange={(e) => update({ dueDate: e.target.value })} />}</Field>
      <Button type="submit" disabled={saving || !draft.title.trim()}>{saving ? "Saving…" : "Save task"}</Button>
    </form>
  );
}
