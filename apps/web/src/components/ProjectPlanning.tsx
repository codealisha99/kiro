"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { request } from "@/lib/api";
import { type WorkDetail, type WorkProject } from "@/lib/work-api";
import { type DataRow } from "@/lib/organization-api";
import { DataTable } from "./OrganizationWorkspace";

type Planning = { goals: DataRow[]; initiatives: DataRow[]; milestones: DataRow[]; task_planning: DataRow[]; availability: DataRow[]; commitments: DataRow[]; skills: DataRow[]; time_entries: DataRow[]; method: string };
type Capacity = { people: DataRow[]; milestones: DataRow[]; method: string; calculatedAt: string };
type Editor = "goals" | "initiatives" | "milestones" | "tasks" | "availability" | "commitments" | "skills" | "time";
const editorLabels: Record<Editor, string> = { goals: "Goal observation", initiatives: "Initiative", milestones: "Milestone", tasks: "Task plan", availability: "Project availability", commitments: "Cross-project commitment", skills: "Skill evidence", time: "Actual effort" };
export default function ProjectPlanning({ detail, projects = [] }: { detail: WorkDetail; projects?: WorkProject[] }) {
  const [data, setData] = useState<Planning | null>(null), [capacity, setCapacity] = useState<Capacity | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0), [editor, setEditor] = useState<Editor>("goals"), [editGoal, setEditGoal] = useState<DataRow | null>(null);
  const base = `/work/projects/${encodeURIComponent(detail.project.id)}/planning`;
  useEffect(() => { let active = true; setLoading(true); setError(""); setData(null); setCapacity(null);
    request<Planning>(base).then(d => { if (active) setData(d); }).catch(e => { if (active) setError((e as Error).message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base, revision]);
  async function action(fn: () => Promise<void>) { setError(""); setBusy(true); try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const text = (name: string, label: string, type = "text", value: string | number = "", required = true) => <Field label={label}>{f => <Input {...f} name={name} type={type} defaultValue={value} required={required} disabled={busy} maxLength={type === "text" ? 1000 : undefined} step={type === "number" ? "0.01" : undefined} min={type === "number" ? "0" : undefined} />}</Field>;
  const choose = (name: string, label: string, rows: { id: string; label: string }[], required = false) => <Field label={label}>{f => <Select {...f} name={name} required={required} disabled={busy}><option value="">{required ? "Select one" : "None"}</option>{rows.map(r => <option value={r.id} key={r.id}>{r.label}</option>)}</Select>}</Field>;
  const options = (rows: DataRow[]) => rows.map(r => ({ id: String(r.id), label: String(r.name) }));
  return <section aria-busy={loading || busy} className="org-stack"><h3>Planning and commitments</h3>
    {error && <Alert tone="danger">{error}</Alert>}{loading && <p role="status">Loading project planning…</p>}
    {data && <><p>{data.method}</p>
      <DataTable title="Goals — reported progress" rows={data.goals} columns={[["name", "Goal"], ["observed", "Observed"], ["target", "Target"], ["unit", "Unit"], ["due_date", "Due"], ["rationale", "Evidence / rationale"]]} />
      {detail.project.can_write && <div className="org-tabs">{data.goals.map(g => <Button key={String(g.id)} variant="secondary" disabled={busy} onClick={() => { setEditor("goals"); setEditGoal(g); }}>Update {String(g.name)}</Button>)}</div>}
      <DataTable title="Initiatives" rows={data.initiatives} columns={[["name", "Initiative"], ["outcome", "Intended outcome"]]} />
      <DataTable title="Milestones" rows={data.milestones} columns={[["name", "Milestone"], ["due_date", "Due"]]} />
      <DataTable title="Task plans" rows={data.task_planning.map(p => ({ ...p, title: detail.tasks.find(t => t.id === p.task_id)?.title ?? "Task outside this page", parent: detail.tasks.find(t => t.id === p.parent_task_id)?.title ?? (p.parent_task_id ? "Task outside this page" : "None"), milestone: data.milestones.find(m => m.id === p.milestone_id)?.name ?? "None" }))} columns={[["title", "Task"], ["priority", "Priority"], ["parent", "Parent"], ["milestone", "Milestone"], ["required_skill", "Required skill"]]} />
      <DataTable title="Recorded skills" rows={data.skills.map(s => ({ ...s, person: detail.members.find(m => m.id === s.user_id)?.name ?? "Former project member" }))} columns={[["person", "Person"], ["skill", "Skill"], ["evidence", "Evidence"]]} />
      <DataTable title="Declared project availability" rows={data.availability.map(a => ({ ...a, person: detail.members.find(m => m.id === a.user_id)?.name ?? "Former project member" }))} columns={[["person", "Person"], ["period_start", "From"], ["period_end", "Through"], ["hours", "Allocated hours"], ["rationale", "Assumptions"]]} />
      <DataTable title="Cross-project commitments" rows={data.commitments.map(c => ({ ...c, person: detail.members.find(m => m.id === c.user_id)?.name ?? "Former project member", source: c.source_project_id ? (projects.find(p => p.id === c.source_project_id)?.name ?? "Project you cannot read") : "New capacity" }))} columns={[["person", "Person"], ["title", "Commitment"], ["source", "From project"], ["period_start", "From"], ["period_end", "Through"], ["hours", "Promised hours"], ["rationale", "Rationale"]]} />
      <DataTable title="Actual effort" rows={data.time_entries} columns={[["worked_on", "Date"], ["hours", "Recorded hours"], ["note", "Note"]]} />
      {detail.project.can_write && <>
        <details><summary>Correct availability or actual effort</summary><p>Voiding preserves the original record and audit history. Re-enter the corrected value afterward.</p>
          {[...data.availability.map(r => ({ id: String(r.id), kind: "availability", label: `${r.period_start}–${r.period_end}: ${r.hours} allocated hours` })), ...data.commitments.map(r => ({ id: String(r.id), kind: "commitment", label: `${r.title}: ${r.period_start}–${r.period_end}: ${r.hours} promised hours` })), ...data.time_entries.map(r => ({ id: String(r.id), kind: "time", label: `${r.worked_on}: ${r.hours} recorded hours` }))].map(r => <Button key={String(r.id)} variant="secondary" disabled={busy} onClick={() => void action(async () => { await request(`${base}/${r.kind}/${r.id}`, { method: "DELETE" }); setRevision(n => n + 1); })}>Void {r.label}</Button>)}
        </details>
        <Field label="Add or update planning record">{f => <Select {...f} value={editor} disabled={busy} onChange={e => { setEditor(e.target.value as Editor); setEditGoal(null); }}>{Object.entries(editorLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>}</Field>
        <form key={`${editor}-${editGoal?.id ?? "new"}-${revision}`} className="org-form" onSubmit={e => {
          e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget).entries());
          const body: Record<string, unknown> = { ...values }; let endpoint = editor as string; let method = "POST";
          for (const k of ["goalId", "initiativeId", "milestoneId", "parentTaskId", "requiredSkill", "dueDate", "sourceProjectId"]) if (body[k] === "") body[k] = null;
          for (const k of ["target", "observed", "hours"]) if (k in body) body[k] = Number(body[k]);
          if (editor === "goals") { body.expectedVersion = Number(editGoal?.version ?? 0); if (editGoal) { endpoint += `/${editGoal.id}`; method = "PUT"; } }
          if (editor === "tasks") { endpoint += `/${body.taskId}`; body.expectedVersion = Number(data.task_planning.find(p => p.task_id === body.taskId)?.version ?? 0); delete body.taskId; method = "PUT"; }
          void action(async () => { await request(`${base}/${endpoint}`, { method, body }); setEditGoal(null); setRevision(n => n + 1); });
        }}>
          {editor === "goals" && <>{text("name", "Goal name", "text", String(editGoal?.name ?? ""))}{text("unit", "Measurement unit", "text", String(editGoal?.unit ?? ""))}{text("target", "Target", "number", String(editGoal?.target ?? ""))}{text("observed", "Reported observation", "number", String(editGoal?.observed ?? ""))}{text("dueDate", "Due date", "date", String(editGoal?.due_date ?? ""), false)}{text("rationale", "Evidence supporting this observation", "text", String(editGoal?.rationale ?? ""))}</>}
          {editor === "initiatives" && <>{text("name", "Initiative name")}{choose("goalId", "Supporting goal", options(data.goals))}{text("outcome", "Intended outcome")}</>}
          {editor === "milestones" && <>{text("name", "Milestone name")}{choose("initiativeId", "Supporting initiative", options(data.initiatives))}{text("dueDate", "Due date", "date")}</>}
          {editor === "tasks" && <>{choose("taskId", "Task", detail.tasks.map(t => ({ id: t.id, label: t.title })), true)}{choose("parentTaskId", "Parent task", detail.tasks.map(t => ({ id: t.id, label: t.title })))}{choose("milestoneId", "Milestone", options(data.milestones))}{choose("priority", "Priority", ["LOW", "NORMAL", "HIGH", "CRITICAL"].map(id => ({ id, label: id })), true)}{text("requiredSkill", "Required skill", "text", "", false)}<p>Saving replaces this task’s planning fields. Task choices follow the currently loaded task page.</p></>}
          {(editor === "availability" || editor === "commitments" || editor === "skills") && choose("userId", "Project member", detail.members.map(m => ({ id: m.id, label: m.name ?? m.id })), true)}
          {editor === "availability" && <>{text("start", "Period start", "date")}{text("end", "Period end", "date")}{text("hours", "Hours allocated to this project", "number")}{text("rationale", "Availability assumptions")}</>}
          {editor === "commitments" && <>{text("title", "Commitment title")}{choose("sourceProjectId", "Capacity drawn from", projects.filter(p => p.id !== detail.project.id).map(p => ({ id: p.id, label: p.name ?? p.id })))}{text("start", "Period start", "date")}{text("end", "Period end", "date")}{text("hours", "Hours promised to this project", "number")}{text("rationale", "Why these hours are committed")}</>}
          {editor === "skills" && <>{text("skill", "Skill")}{text("evidence", "Evidence of capability")}</>}
          {editor === "time" && <>{choose("taskId", "Task", detail.tasks.map(t => ({ id: t.id, label: t.title })), true)}{text("workedOn", "Work date", "date")}{text("hours", "Your actual hours", "number")}{text("note", "Work performed")}</>}
          <Button type="submit" disabled={busy}>Save {editorLabels[editor].toLowerCase()}</Button>
        </form>
      </>}
      <h3>Capacity and milestone progress</h3><form className="org-form" onSubmit={e => { e.preventDefault(); const b = new FormData(e.currentTarget); void action(async () => { setCapacity(null); setCapacity(await request<Capacity>(`${base}/capacity?start=${b.get("start")}&end=${b.get("end")}`)); }); }}>
        {text("start", "Planning period start", "date")}{text("end", "Planning period end", "date")}<Button type="submit" disabled={busy}>Calculate from recorded work</Button>
      </form>
      {capacity && <><p>{capacity.method} Calculated {new Date(capacity.calculatedAt).toLocaleString()}.</p><DataTable title="Project allocation load" rows={capacity.people} columns={[["name", "Person"], ["remaining_hours", "Known hours"], ["available_hours", "Allocated hours"], ["committed_hours", "Commitments"], ["other_committed_hours", "Committed elsewhere"], ["visible_cross_hours", "Visible cross commitments"], ["allocation_load_percent", "Load %"], ["missing_estimates", "Missing estimates"], ["undated_tasks", "Undated tasks"]]} /><DataTable title="Milestone delivery" rows={capacity.milestones} columns={[["name", "Milestone"], ["due_date", "Due"], ["tasks", "Tasks"], ["completed", "Completed"], ["blocked", "Blocked"]]} /></>}
    </>}
  </section>;
}
