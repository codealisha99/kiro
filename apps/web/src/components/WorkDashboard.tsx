"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Dialog, Field, Input, Select } from "@/components/ui";
import { workApi, type WorkDetail, type WorkInsight, type WorkNotification, type WorkOverview, type WorkProject, type WorkTask, type WorkScenario } from "@/lib/work-api";
import "./work-dashboard.css";
import { orgApi, type DataRow } from "@/lib/organization-api";
import ProjectSources from "./ProjectSources";
import ProjectPlanning from "./ProjectPlanning";
import ProjectActions from "./ProjectActions";

const emptyTask = { title: "", status: "TODO" as WorkTask["status"], assigneeId: "", remainingHours: "", dueDate: "" };
const labels = { OVERDUE: "Overdue commitment", BLOCKED: "Recorded blocker", UNASSIGNED: "Ownership gap" };
const recommendations = {
  OVERDUE: "Review the due date and agree on a recovery plan.",
  BLOCKED: "Confirm the blocker and identify who can resolve it.",
  UNASSIGNED: "Agree on an owner with project access.",
};
type ScenarioOutcomeStatus = "IN_PROGRESS" | "DELIVERED" | "NOT_DELIVERED" | "CANCELLED";

export default function WorkDashboard() {
  const [teams, setTeams] = useState<DataRow[]>([]);
  const [audienceTeam, setAudienceTeam] = useState("");
  const [restricted, setRestricted] = useState(true);
  const [overview, setOverview] = useState<WorkOverview | null>(null);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [insights, setInsights] = useState<WorkInsight[]>([]);
  const [notifications, setNotifications] = useState<WorkNotification[]>([]);
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [task, setTask] = useState(emptyTask);
  const [editing, setEditing] = useState<WorkTask | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [evidence, setEvidence] = useState<WorkInsight | null>(null);
  const [canTriage, setCanTriage] = useState(false);
  const [triageReason, setTriageReason] = useState("");
  const [impact, setImpact] = useState<{ title: string; tasks: WorkTask[] } | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof workApi.history>> | null>(null);
  const [grantUser, setGrantUser] = useState("");
  const [grantPermission, setGrantPermission] = useState("READ");
  const [dependency, setDependency] = useState({ task: "", target: "", rationale: "" });
  const [scenario, setScenario] = useState<WorkScenario | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [outcomeDraft, setOutcomeDraft] = useState({ status: "IN_PROGRESS" as ScenarioOutcomeStatus, actualHours: "", note: "" });
  const [savedScenarios, setSavedScenarios] = useState<WorkScenario[]>([]);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<WorkScenario[] | null>(null);
  const [assumptions, setAssumptions] = useState({ name: "", periodStart: "", periodEnd: "", availableHours: "", proposedHours: "", rationale: "" });
  const [projectOffset, setProjectOffset] = useState(0);
  const [taskOffset, setTaskOffset] = useState(0);
  const [insightOffset, setInsightOffset] = useState(0);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const run = ++generation.current;
    setLoading(true); setError(""); setDetail(null); setEvidence(null); setImpact(null); setHistory(null); setScenario(null);
    setSavedScenarios([]); setSelectedScenarioIds([]); setComparison(null);
    try {
      const [o, p, i, n] = await Promise.all([workApi.overview(), workApi.projects(projectOffset), workApi.insights(insightOffset), workApi.notifications()]);
      if (run === generation.current) { setOverview(o); setProjects(p); setInsights(i); setNotifications(n); }
    } catch (e) {
      if (run === generation.current) { setOverview(null); setProjects([]); setInsights([]); setNotifications([]); setError((e as Error).message); }
    } finally { if (run === generation.current) setLoading(false); }
  }, [projectOffset, insightOffset]);
  useEffect(() => {
    const activeGeneration = generation;
    void refresh();
    return () => { activeGeneration.current++; };
  }, [refresh]);

  async function action(fn: () => Promise<void>) {
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function openProject(id: string, offset = 0) {
    setDetail(null); setHistory(null); setImpact(null); setEvidence(null); setScenario(null);
    setComparison(null);
    const [d, scenarios] = await Promise.all([workApi.detail(id, offset), workApi.scenarios(id)]);
    setTeams(await orgApi.teams());
    setAudienceTeam(d.project.team_id ?? ""); setRestricted(d.project.restricted ?? true);
    setDetail(d); setSavedScenarios(scenarios); setSelectedScenarioIds([]); setTaskOffset(offset);
    setDependency({ task: "", target: "", rationale: "" });
  }
  function editTask(t?: WorkTask) {
    setEditing(t ?? null);
    setTask(t ? { title: t.title, status: t.status, assigneeId: t.assignee_id ?? "",
      remainingHours: t.remaining_hours === null ? "" : String(t.remaining_hours), dueDate: t.due_date ?? "" } : emptyTask);
    setTaskOpen(true);
  }
  function inspectScenario(value: WorkScenario) {
    setScenario(value); setApprovalReason("");
    setOutcomeDraft({ status: value.outcome.status === "NONE" ? "IN_PROGRESS" : value.outcome.status,
      actualHours: value.outcome.actual_hours == null ? "" : String(value.outcome.actual_hours), note: value.outcome.note ?? "" });
  }

  return <section className="work-dashboard" aria-busy={busy || loading}>
    <div className="work-heading"><div><p className="work-eyebrow">Organizational intelligence</p>
      <h1>Work in focus</h1><p>Recorded work, emerging risks, and the evidence behind them.</p></div>
      <Button variant="secondary" disabled={busy || loading} onClick={() => void refresh()}>Refresh</Button></div>
    {error && <Alert tone="danger">{error} Access may have changed. Refresh to reload authorized records.</Alert>}
    {loading && <p role="status">Loading authorized work…</p>}
    {overview && <>
      <p>{overview.scope}. Calculated {new Date(overview.calculatedAt).toLocaleString()}.</p>
      <div className="work-metrics">
        {[
          ["Recorded tasks", overview.metrics.total_tasks],
          ["Completed", overview.metrics.completed_tasks],
          ["Overdue", overview.metrics.overdue_tasks],
          ["Blocked", overview.metrics.blocked_tasks],
          ["Unassigned", overview.metrics.unassigned_tasks],
          ["Estimated hours remaining", overview.metrics.estimated_remaining_hours],
        ].map(([label, value]) => <Card key={label}><span>{label}</span><strong>{value}</strong></Card>)}
      </div>
      <details><summary>Calculation and data quality</summary><p>{overview.method}</p>
        <p>{overview.metrics.missing_estimates} unfinished tasks lack effort estimates. Hours are estimates, not actual effort.</p>
        <p>{overview.utilizationUnavailable}</p><p>{overview.freshness}. Reporting period: {overview.period}.</p>
        <p>Last task update: {overview.metrics.last_record_updated_at ? new Date(overview.metrics.last_record_updated_at).toLocaleString() : "No tasks recorded"}.
          This view is a snapshot; refresh after access or work changes.</p></details>
    </>}
    <Card><h2>Notifications</h2><p>In-app updates for scenario approval requests and decisions, limited to projects you can still access.</p>
      {!notifications.length ? <p>No notifications.</p> : <ul className="work-list">{notifications.map(n => <li key={n.id}>
        <Badge tone={n.read_at ? "neutral" : "info"}>{n.read_at ? "Read" : "New"}</Badge>
        <p>{n.kind === "SCENARIO_APPROVAL_REQUESTED" ? "A scenario needs review" : "A scenario approval was decided"} · {n.project_name} · {new Date(n.created_at).toLocaleString()}</p>
        <div className="work-actions"><Button variant="secondary" disabled={busy} onClick={() => void action(async () => {
          inspectScenario(await workApi.scenarioResult(n.resource_id));
          if (!n.read_at) { await workApi.readNotification(n.id); setNotifications(current => current.map(item => item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item)); }
        })}>Review scenario</Button>
          {!n.read_at && <Button variant="secondary" disabled={busy} onClick={() => void action(async () => {
            await workApi.readNotification(n.id); setNotifications(current => current.map(item => item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item));
          })}>Mark read</Button>}</div>
      </li>)}</ul>}
    </Card>
    <div className="work-columns">
      <Card><h2>Projects</h2>
        <form className="work-form" onSubmit={e => { e.preventDefault(); void action(async () => {
          const p = await workApi.createProject(name); setName(""); await refresh(); await openProject(p.id);
        }); }}>
          <Field label="New project name">{f => <Input {...f} required maxLength={200} value={name} disabled={busy} onChange={e => setName(e.target.value)} />}</Field>
          <Button type="submit" disabled={busy || !name.trim()}>Create project</Button>
        </form>
        {!loading && !projects.length && <p>No projects on this page. Create one or ask its owner for access.</p>}
        <ul className="work-list">{projects.map(p => <li key={p.id}><Button variant="secondary" disabled={busy}
          onClick={() => void action(() => openProject(p.id))}>{p.name}</Button></li>)}</ul>
        <div className="work-actions"><Button variant="secondary" disabled={busy || loading || !projectOffset} onClick={() => setProjectOffset(projectOffset - 100)}>Previous projects</Button>
          <Button variant="secondary" disabled={busy || loading || projects.length < 100} onClick={() => setProjectOffset(projectOffset + 100)}>Next projects</Button></div>
      </Card>
      <Card><h2>Insight center</h2><p>Rule-based observations from recorded tasks. Suggestions require human judgment.</p>
        {!loading && !insights.length && <p>No detected risks on this page. This does not establish that all work is on track.</p>}
        <ul className="work-list">{insights.map(i => <li key={i.id}>
          <Badge tone={i.resolved_at ? "success" : "warning"}>{i.resolved_at ? "Resolved" : labels[i.rule]}</Badge>
          {!i.resolved_at && i.triage_status !== "OPEN" && <Badge>{i.triage_status === "ACKNOWLEDGED" ? "Acknowledged" : "Dismissed"}</Badge>}
          <h3>{i.title}</h3><p>{recommendations[i.rule]}</p>
          <Button variant="secondary" disabled={busy} onClick={() => void action(async () => {
            // Recheck current access before opening saved evidence.
            const current = await workApi.detail(i.project_id);
            setCanTriage(!!current.project.can_write); setTriageReason(""); setEvidence(i);
          })}>Inspect evidence</Button>
        </li>)}</ul>
        <div className="work-actions"><Button variant="secondary" disabled={busy || loading || !insightOffset} onClick={() => setInsightOffset(insightOffset - 100)}>Previous insights</Button>
          <Button variant="secondary" disabled={busy || loading || insights.length < 100} onClick={() => setInsightOffset(insightOffset + 100)}>Next insights</Button></div>
      </Card>
    </div>
    {detail && <Card>
      <div className="work-heading"><div><h2>{detail.project.name}</h2><p>{detail.project.can_write ? "You can edit this project." : "Read-only project access."}</p></div>
        <div className="work-actions">
          <Button variant="secondary" disabled={busy} onClick={() => void action(async () => setHistory(await workApi.history(detail.project.id)))}>Change history</Button>
          {detail.project.can_write && <Button disabled={busy} onClick={() => editTask()}>Add task</Button>}
        </div></div>
      <details><summary>Planning, goals and capacity</summary><ProjectPlanning key={detail.project.id} detail={detail} projects={projects} /></details>
      <details><summary>Approved provider actions</summary><ProjectActions key={detail.project.id} detail={detail} /></details>
      <ProjectSources key={detail.project.id} projectId={detail.project.id} canWrite={!!detail.project.can_write} />
      {!detail.tasks.length && <p>No tasks on this page.</p>}
      <ul className="work-list">{detail.tasks.map(t => <li key={t.id}>
        <div className="work-heading"><div><h3>{t.title}</h3><Badge>{t.status.replaceAll("_", " ")}</Badge>
          <p>Due: {t.due_date ?? "Not set"} · Remaining estimate: {t.remaining_hours === null ? "Unknown" : `${t.remaining_hours} hours`}</p>
          <p>Owner: {detail.members.find(m => m.id === t.assignee_id)?.name ?? (t.assignee_id ? "Access no longer granted" : "Unassigned")}</p></div>
          <div className="work-actions">{detail.project.can_write && <Button variant="secondary" disabled={busy} onClick={() => editTask(t)}>Edit task</Button>}
            <Button variant="secondary" disabled={busy} onClick={() => void action(async () => setImpact({ title: t.title, tasks: await workApi.impact(t.id) }))}>Explore impact</Button></div></div>
      </li>)}</ul>
      <div className="work-actions"><Button variant="secondary" disabled={busy || !taskOffset} onClick={() => void action(() => openProject(detail.project.id, taskOffset - 100))}>Previous tasks</Button>
        <Button variant="secondary" disabled={busy || detail.tasks.length < 100} onClick={() => void action(() => openProject(detail.project.id, taskOffset + 100))}>Next tasks</Button></div>
      {detail.project.can_write && <details><summary>Record a dependency</summary>
        <form className="work-form" onSubmit={e => { e.preventDefault(); void action(async () => {
          await workApi.dependency(dependency.task, dependency.target, dependency.rationale);
          setDependency({ task: "", target: "", rationale: "" });
          await openProject(detail.project.id, taskOffset);
        }); }}>
          <Field label="Dependent task">{f => <Select {...f} required value={dependency.task} onChange={e => setDependency({ ...dependency, task: e.target.value })}>
            <option value="">Choose a task</option>{detail.tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</Select>}</Field>
          <Field label="Prerequisite task">{f => <Select {...f} required value={dependency.target} onChange={e => setDependency({ ...dependency, target: e.target.value })}>
            <option value="">Choose a task</option>{detail.tasks.filter(t => t.id !== dependency.task).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</Select>}</Field>
          <Field label="Reason">{f => <Input {...f} required maxLength={1000} value={dependency.rationale} onChange={e => setDependency({ ...dependency, rationale: e.target.value })} />}</Field>
          <Button type="submit" disabled={busy}>Save dependency</Button>
        </form></details>}
      {detail.project.can_write && <details><summary>Evaluate proposed work</summary>
        <p>Compare recorded effort with explicit assumptions for this project. This does not forecast delivery or account for work outside this project.</p>
        <form className="work-form" onSubmit={e => { e.preventDefault(); void action(async () => {
          inspectScenario(await workApi.scenario(detail.project.id, { ...assumptions,
            availableHours: Number(assumptions.availableHours), proposedHours: Number(assumptions.proposedHours) }));
          setSavedScenarios(await workApi.scenarios(detail.project.id));
        }); }}>
          <Field label="Scenario name">{f => <Input {...f} required maxLength={200} value={assumptions.name} onChange={e => setAssumptions({ ...assumptions, name: e.target.value })} />}</Field>
          <Field label="Planning period starts">{f => <Input {...f} required type="date" value={assumptions.periodStart} onChange={e => setAssumptions({ ...assumptions, periodStart: e.target.value })} />}</Field>
          <Field label="Planning period ends">{f => <Input {...f} required type="date" min={assumptions.periodStart} value={assumptions.periodEnd} onChange={e => setAssumptions({ ...assumptions, periodEnd: e.target.value })} />}</Field>
          <Field label="Assumed available project hours">{f => <Input {...f} required type="number" min="0.01" max="100000" step="0.01" value={assumptions.availableHours} onChange={e => setAssumptions({ ...assumptions, availableHours: e.target.value })} />}</Field>
          <Field label="Estimated hours for proposed work">{f => <Input {...f} required type="number" min="0" max="100000" step="0.01" value={assumptions.proposedHours} onChange={e => setAssumptions({ ...assumptions, proposedHours: e.target.value })} />}</Field>
          <Field label="Basis for these assumptions">{f => <Input {...f} required maxLength={1000} value={assumptions.rationale} onChange={e => setAssumptions({ ...assumptions, rationale: e.target.value })} />}</Field>
          <Button type="submit" disabled={busy}>Evaluate and save scenario</Button>
        </form>
      </details>}
      <details className="scenario-compare">
        <summary>Compare saved scenarios</summary>
        <p>Compare two to four saved scenarios for this project. Each result uses its saved task evidence and declared assumptions.</p>
        {!savedScenarios.length ? <p>No saved scenarios yet. Create one above to start a comparison.</p> : <>
          <ul className="scenario-choices">{savedScenarios.map(s => <li key={s.id}>
            <div className="scenario-choice-row"><label><input type="checkbox" checked={selectedScenarioIds.includes(s.id)} disabled={busy || (!selectedScenarioIds.includes(s.id) && selectedScenarioIds.length >= 4)}
              onChange={e => setSelectedScenarioIds(current => e.target.checked ? [...current, s.id] : current.filter(id => id !== s.id))} />
              <span><strong>{s.name}</strong><small>{s.assessment.replaceAll("_", " ")} · {s.period_start} to {s.period_end} · Approval: {s.approval.status.toLowerCase()}</small></span>
            </label><Button variant="secondary" disabled={busy} onClick={() => inspectScenario(s)}>Review</Button></div>
          </li>)}</ul>
          <Button variant="secondary" disabled={busy || selectedScenarioIds.length < 2} onClick={() => void action(async () => {
            setComparison(await workApi.compareScenarios(detail.project.id, selectedScenarioIds));
          })}>Compare selected scenarios</Button>
        </>}
      </details>
      {detail.project.can_manage_access && <details><summary>Project audience & team</summary>
        <p>Restricted projects use only ownership and explicit project grants. Sharing with organizational scope lets team members read and scoped roles read or write according to their configured permissions.</p>
        <form className="work-form" onSubmit={e => { e.preventDefault(); void action(async () => {
          await orgApi.audience(detail.project.id, audienceTeam || null, restricted); await openProject(detail.project.id);
        }); }}>
          <Field label="Owning team">{f => <Select {...f} disabled={busy} value={audienceTeam} onChange={e => setAudienceTeam(e.target.value)}>
            <option value="">No team</option>{teams.map(t => <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>)}</Select>}</Field>
          <Field label="Project visibility">{f => <Select {...f} disabled={busy} value={restricted ? "restricted" : "organization"} onChange={e => setRestricted(e.target.value === "restricted")}>
            <option value="restricted">Restricted — explicit project grants only</option><option value="organization">Share with team and scoped organizational roles</option></Select>}</Field>
          <Button type="submit" disabled={busy}>Save project audience</Button>
        </form></details>}
      {detail.project.can_manage_access && <details><summary>Manage explicit project access</summary>
        <p>Use an existing workspace member’s ID. Organization administrators do not automatically receive access.</p>
        <form className="work-form" onSubmit={e => { e.preventDefault(); void action(async () => {
          await workApi.grant(detail.project.id, grantUser, grantPermission); setGrantUser(""); await openProject(detail.project.id);
        }); }}>
          <Field label="Member ID">{f => <Input {...f} required value={grantUser} onChange={e => setGrantUser(e.target.value)} />}</Field>
          <Field label="Permission">{f => <Select {...f} value={grantPermission} onChange={e => setGrantPermission(e.target.value)}><option value="READ">Read</option><option value="WRITE">Read and edit</option></Select>}</Field>
          <Button type="submit" disabled={busy}>Grant access</Button>
        </form>
        <ul className="work-list">{detail.members.filter(m => m.id !== detail.project.owner_id).map(m => <li key={m.id}>{m.name ?? m.id}{" "}
          <Button variant="secondary" disabled={busy} onClick={() => void action(async () => {
            await workApi.grant(detail.project.id, m.id, "READ", true); await openProject(detail.project.id);
          })}>Revoke access</Button></li>)}</ul>
      </details>}
    </Card>}
    <Dialog open={taskOpen} onClose={() => setTaskOpen(false)} closeDisabled={busy} title={editing ? "Edit task" : "Add task"}>
      <form className="work-form" onSubmit={e => { e.preventDefault(); if (!detail) return; void action(async () => {
        const project = detail.project.id;
        await workApi.saveTask(project, { title: task.title, status: task.status, assigneeId: task.assigneeId || null,
          remainingHours: task.remainingHours === "" ? null : Number(task.remainingHours), dueDate: task.dueDate || null,
          expectedVersion: editing?.version }, editing?.id);
        setTaskOpen(false); await refresh(); await openProject(project);
      }); }}>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Task title">{f => <Input {...f} required maxLength={200} disabled={busy} value={task.title} onChange={e => setTask({ ...task, title: e.target.value })} />}</Field>
        <Field label="Status">{f => <Select {...f} disabled={busy} value={task.status} onChange={e => setTask({ ...task, status: e.target.value as WorkTask["status"] })}>
          {["TODO", "IN_PROGRESS", "BLOCKED", "DONE"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</Select>}</Field>
        <Field label="Assignee">{f => <Select {...f} disabled={busy} value={task.assigneeId} onChange={e => setTask({ ...task, assigneeId: e.target.value })}>
          <option value="">Unassigned</option>{detail?.members.map(m => <option key={m.id} value={m.id}>{m.name ?? m.id}</option>)}</Select>}</Field>
        <Field label="Remaining effort (estimated hours)" hint="Leave blank if unknown.">{f => <Input {...f} disabled={busy} type="number" min="0" max="100000" step="0.01" value={task.remainingHours} onChange={e => setTask({ ...task, remainingHours: e.target.value })} />}</Field>
        <Field label="Due date (UTC)">{f => <Input {...f} disabled={busy} type="date" value={task.dueDate} onChange={e => setTask({ ...task, dueDate: e.target.value })} />}</Field>
        <Button type="submit" disabled={busy || !task.title.trim()}>{busy ? "Saving…" : "Save task"}</Button>
      </form>
    </Dialog>
    <Dialog open={!!evidence} onClose={() => setEvidence(null)} closeDisabled={busy} title="Insight evidence">
      {evidence && <><Badge>Calculated observation</Badge><h3>{labels[evidence.rule]}</h3>
        {error && <Alert tone="danger">{error}</Alert>}
        <p>Task: {evidence.title}</p><p>Observed version: {evidence.evidence_version}. Status: {evidence.evidence_status}. Due: {evidence.evidence_due_date ?? "Not set"}.</p>
        <p>Detected {new Date(evidence.detected_at).toLocaleString()}. {evidence.resolved_at ? `Resolved ${new Date(evidence.resolved_at).toLocaleString()}.` : "Active at the last refresh."}</p>
        <p>Source: manually recorded task {evidence.task_id}. Current task title may differ from the historical version.</p>
        <p>Suggested next step: {recommendations[evidence.rule]}</p>
        <p>Review status: {evidence.triage_status.toLowerCase()}. {evidence.triage_reason}</p>
        <p>The condition resolves when the task no longer triggers this rule. Task changes reopen dismissed or acknowledged observations for review.</p>
        {!evidence.resolved_at && canTriage && <div className="work-form">
          <Field label="Review reason" hint="Required when dismissing an observation.">{f => <Input {...f} maxLength={1000} disabled={busy}
            value={triageReason} onChange={e => setTriageReason(e.target.value)} />}</Field>
          <div className="work-actions">{(["ACKNOWLEDGED", "DISMISSED", "OPEN"] as const).filter(s => s !== evidence.triage_status).map(status =>
            <Button key={status} variant="secondary" disabled={busy || (status === "DISMISSED" && !triageReason.trim())}
              onClick={() => void action(async () => {
                await workApi.triage(evidence.id, status, triageReason, evidence.triage_version);
                await refresh();
              })}>{status === "ACKNOWLEDGED" ? "Acknowledge" : status === "DISMISSED" ? "Dismiss with reason" : "Reopen for review"}</Button>)}</div>
        </div>}</>}
    </Dialog>
    <Dialog open={!!impact} onClose={() => setImpact(null)} title="Dependency impact">
      {impact && <><h3>{impact.title}</h3><p>Recorded downstream dependencies within your current access. Up to 100 tasks; hidden relationships are excluded.</p>
        {impact.tasks.length ? <ul>{impact.tasks.map(t => <li key={t.id}>{t.title} — {t.status}</li>)}</ul> : <p>No accessible downstream dependencies recorded.</p>}
        <p>This is a relationship query, not a delivery forecast.</p></>}
    </Dialog>
    <Dialog open={!!scenario} onClose={() => setScenario(null)} closeDisabled={busy} title="Scenario result">
      {scenario && <><Badge>What-if calculation</Badge><h3>{scenario.name}</h3><p>{scenario.assessment.replaceAll("_", " ")}</p>
        <p>Known remaining effort: {scenario.known_remaining_hours} hours. Proposed work: {scenario.proposed_hours} hours. Assumed availability: {scenario.available_hours} hours.</p>
        <p>{scenario.remaining_assumed_hours === null ? "Capacity conclusion withheld because required data is missing." : `Remaining assumed capacity: ${scenario.remaining_assumed_hours} hours.`}</p>
        <p>{scenario.missing_estimates} missing estimates; {scenario.undated_tasks} undated tasks.</p><p>{scenario.method}</p><p>{scenario.limitations}</p>
        <p>Approval status: {scenario.approval.status.toLowerCase()}. {scenario.approval.reason}</p>
        {scenario.approval.status === "NONE" && detail?.project.can_write && <Button disabled={busy} onClick={() => void action(async () => {
          setScenario(await workApi.requestScenarioApproval(scenario.id)); setSavedScenarios(await workApi.scenarios(detail.project.id));
        })}>Request approval</Button>}
        {scenario.approval.status === "PENDING" && scenario.approval.requested_by === detail?.viewer_id && <p>Waiting for a different project editor to review this request.</p>}
        {scenario.approval.status === "PENDING" && detail?.project.can_write && scenario.approval.requested_by !== detail.viewer_id && <div className="work-form">
          <Field label="Decision reason" hint="Required when rejecting this scenario.">{f => <Input {...f} maxLength={1000} disabled={busy} value={approvalReason} onChange={e => setApprovalReason(e.target.value)} />}</Field>
          <div className="work-actions"><Button disabled={busy} onClick={() => void action(async () => {
            setScenario(await workApi.decideScenarioApproval(scenario.id, "APPROVED", approvalReason, scenario.approval.version));
            setSavedScenarios(await workApi.scenarios(detail.project.id));
          })}>Approve</Button><Button variant="secondary" disabled={busy || !approvalReason.trim()} onClick={() => void action(async () => {
            setScenario(await workApi.decideScenarioApproval(scenario.id, "REJECTED", approvalReason, scenario.approval.version));
            setSavedScenarios(await workApi.scenarios(detail.project.id));
          })}>Reject</Button></div>
        </div>}
        <p>Approval records an internal decision only. It does not execute a change in an external service.</p>
        <p>Recorded outcome: {scenario.outcome.status === "NONE" ? "not recorded" : scenario.outcome.status.toLowerCase().replaceAll("_", " ")}.
          {scenario.outcome.actual_hours == null ? " Actual effort not recorded." : ` Actual effort: ${scenario.outcome.actual_hours} hours (${scenario.outcome.actual_hours - scenario.proposed_hours >= 0 ? "+" : ""}${scenario.outcome.actual_hours - scenario.proposed_hours} hours against the estimate).`}
          {scenario.outcome.note ? ` ${scenario.outcome.note}` : ""}</p>
        {detail?.project.can_write && <form className="work-form" onSubmit={e => { e.preventDefault(); void action(async () => {
          const updated = await workApi.saveScenarioOutcome(scenario.id, { status: outcomeDraft.status,
            actualHours: outcomeDraft.actualHours === "" ? null : Number(outcomeDraft.actualHours), note: outcomeDraft.note,
            expectedVersion: scenario.outcome.version });
          inspectScenario(updated); setSavedScenarios(await workApi.scenarios(detail.project.id));
        }); }}>
          <Field label="Outcome status">{f => <Select {...f} disabled={busy} value={outcomeDraft.status} onChange={e => setOutcomeDraft({ ...outcomeDraft, status: e.target.value as ScenarioOutcomeStatus })}>
            <option value="IN_PROGRESS">In progress</option><option value="DELIVERED">Delivered</option><option value="NOT_DELIVERED">Not delivered</option><option value="CANCELLED">Cancelled</option>
          </Select>}</Field>
          <Field label="Actual effort on proposed work (hours)" hint="Leave blank if unknown.">{f => <Input {...f} disabled={busy} type="number" min="0" max="100000" step="0.01" value={outcomeDraft.actualHours} onChange={e => setOutcomeDraft({ ...outcomeDraft, actualHours: e.target.value })} />}</Field>
          <Field label="Outcome note">{f => <Input {...f} required maxLength={1000} disabled={busy} value={outcomeDraft.note} onChange={e => setOutcomeDraft({ ...outcomeDraft, note: e.target.value })} />}</Field>
          <Button type="submit" disabled={busy || !outcomeDraft.note.trim()}>Save outcome</Button>
        </form>}
        <details><summary>Evidence snapshot</summary><ul>{scenario.evidence.map(e => <li key={e.task_id}>Task {e.task_id}, version {e.task_version}: {e.remaining_hours ?? "unknown"} hours, due {e.due_date ?? "unknown"}.</li>)}</ul></details></>}
    </Dialog>
    <Dialog open={!!comparison} onClose={() => setComparison(null)} title="Scenario comparison">
      {comparison && <><p>Saved calculations for the selected project. Values retain each scenario’s original evidence snapshot.</p>
        <div className="scenario-table-wrap"><table className="scenario-table"><thead><tr><th>Scenario</th><th>Assessment</th><th>Approval</th><th>Outcome</th><th>Actual hours</th><th>Recorded effort</th><th>Proposed</th><th>Assumed capacity</th><th>Remaining</th><th>Data gaps</th></tr></thead>
          <tbody>{comparison.map(s => <tr key={s.id}><th scope="row">{s.name}</th><td>{s.assessment.replaceAll("_", " ")}</td>
            <td>{s.approval.status.toLowerCase()}</td><td>{s.outcome.status.toLowerCase().replaceAll("_", " ")}</td>
            <td>{s.outcome.actual_hours == null ? "Unknown" : `${s.outcome.actual_hours} h`}</td>
            <td>{s.known_remaining_hours} h</td><td>{s.proposed_hours} h</td><td>{s.available_hours} h</td>
            <td>{s.remaining_assumed_hours === null ? "Withheld" : `${s.remaining_assumed_hours} h`}</td>
            <td>{s.missing_estimates} missing estimates; {s.undated_tasks} undated</td></tr>)}</tbody></table></div>
        <p>These are assumption-based what-if calculations, not forecasts. Capacity is withheld for scenarios with missing estimates or undated tasks.</p>
      </>}
    </Dialog>
    <Dialog open={!!history} onClose={() => setHistory(null)} title="Project change history">
      <p>Most recent 100 authorized events. Earlier task versions remain preserved.</p>
      <ul className="work-list">{history?.map(e => <li key={e.id}><strong>{e.kind.replaceAll("_", " ")}</strong><p>{new Date(e.occurred_at).toLocaleString()}</p>
        <details><summary>Recorded evidence</summary><pre>{JSON.stringify(JSON.parse(e.payload), null, 2)}</pre></details></li>)}</ul>
    </Dialog>
  </section>;
}
