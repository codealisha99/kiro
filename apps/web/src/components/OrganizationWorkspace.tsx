"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { request } from "@/lib/api";
import { orgApi, type DashboardData, type DashboardView, type DataRow, type OrgRole, type OrgSetup } from "@/lib/organization-api";
import IntegrationsPanel from "./IntegrationsPanel";
import OrganizationExplorer from "./OrganizationExplorer";
import "./organization.css";

const views: Record<DashboardView, { title: string; description: string }> = {
  EMPLOYEE: { title: "My workday", description: "Your assigned work, upcoming deadlines, and observations that need your attention." },
  MANAGER: { title: "Team delivery", description: "Ownership, recorded workload, blockers, and your reporting relationships." },
  DIRECTOR: { title: "Department delivery", description: "Compare authorized teams and review project execution across your departments." },
  VP: { title: "Department portfolio", description: "Department-level delivery and resource gaps across your explicitly granted scope." },
  CEO: { title: "Company overview", description: "Cross-department dependencies, project portfolios, and material recorded risks within your granted scope." },
};
export function DataTable({ title, rows, columns }: { title: string; rows: DataRow[]; columns: [string, string][] }) {
  return <Card><h2>{title}</h2>{!rows.length ? <p>No authorized records to display.</p> : <div className="org-table-scroll"><table>
    <thead><tr>{columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={String(row.id ?? i)}>{columns.map(([key]) => <td key={key}>
      {row[key] === null || row[key] === undefined ? "Not recorded" : String(row[key])}</td>)}</tr>)}</tbody>
  </table></div>}</Card>;
}
interface FormField { name: string; label: string; options?: { id: string; name: string }[]; optional?: boolean; type?: string }
function AdminForm({ title, fields, submit, busy }: { title: string; fields: FormField[]; submit: (data: Record<string, string>) => Promise<void>; busy: boolean }) {
  return <Card><h2>{title}</h2><form className="org-form" onSubmit={e => {
    e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    void submit(data).then(() => form.reset()).catch(() => {});
  }}>{fields.map(item => <Field key={item.name} label={item.label}>{f => item.options ?
    <Select {...f} name={item.name} required={!item.optional} disabled={busy} defaultValue=""><option value="">Choose…</option>
      {item.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</Select> :
    <Input {...f} name={item.name} type={item.type ?? "text"} autoComplete={item.type === "password" ? "new-password" : "off"} maxLength={200} required={!item.optional} disabled={busy} />}</Field>)}
    <Button type="submit" disabled={busy}>Save {title.toLowerCase()}</Button></form></Card>;
}
const permissions = ["PROJECT_READ", "PROJECT_WRITE", "ORG_MANAGE", "INTEGRATION_MANAGE"];
function RoleForm({ role, busy, save }: { role?: OrgRole; busy: boolean; save: (body: unknown, id?: string) => Promise<void> }) {
  return <form className="org-form" onSubmit={e => {
    e.preventDefault(); const form = e.currentTarget; const data = new FormData(form);
    void save({ name: data.get("name"), dashboard: data.get("dashboard"), permissions: data.getAll("permission"), expectedVersion: role?.version }, role?.id)
      .then(() => { if (!role) form.reset(); }).catch(() => {});
  }}><Field label="Role name">{f => <Input {...f} name="name" required maxLength={100} defaultValue={role?.name} disabled={busy} />}</Field>
    <Field label="Dashboard">{f => <Select {...f} name="dashboard" defaultValue={role?.dashboard ?? "EMPLOYEE"} disabled={busy}>
      {[...Object.keys(views), "ADMIN"].map(v => <option key={v}>{v}</option>)}</Select>}</Field>
    <fieldset disabled={busy}><legend>Granted permissions</legend>{permissions.map(p => <label className="org-check" key={p}>
      <input type="checkbox" name="permission" value={p} defaultChecked={role?.permissions.includes(p)} />{p.replaceAll("_", " ").toLowerCase()}</label>)}</fieldset>
    <p>Write requires read. Organization and integration management apply only to company-scoped grants. Dashboard choice alone grants no data access.</p>
    <Button type="submit" disabled={busy}>{role ? "Update role" : "Create role"}</Button></form>;
}
export default function OrganizationWorkspace() {
  const [explore, setExplore] = useState(false);
  const [setup, setSetup] = useState<OrgSetup | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [view, setView] = useState<DashboardView>("EMPLOYEE");
  const [tab, setTab] = useState<"dashboard" | "organization" | "integrations">("dashboard");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<DataRow[] | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration") === "xero") setTab("integrations");
  }, []);
  const reload = useCallback(async () => { const s = await orgApi.setup(); setSetup(s); return s; }, []);
  useEffect(() => { let active = true; setLoading(true); setError(""); setData(null);
    Promise.all([orgApi.setup(), orgApi.dashboard(view)]).then(([s, d]) => { if (active) { setSetup(s); setData(d); } })
      .catch(e => { if (active) { setSetup(null); setError((e as Error).message); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [view]);
  async function act(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn(); await reload(); }
    catch (e) { setError((e as Error).message); throw e; } finally { setBusy(false); } }
  const save = (path: string, body: unknown, method = "POST") => act(() => orgApi.save(path, body, method));
  const options = (rows: DataRow[] | undefined) => (rows ?? []).map(r => ({ id: String(r.id), name: String(r.name ?? r.email ?? r.id) }));
  const person = (id: unknown) => setup?.users?.find(u => u.id === id)?.name ?? id;
  return <section className="organization-workspace" aria-busy={busy || loading}>
    <div className="org-heading"><div><p className="org-eyebrow">Company intelligence</p><h1>{tab === "dashboard" ? views[view].title : tab === "organization" ? "Organization & access" : "Connected applications"}</h1></div>
      <Button variant="secondary" disabled={busy || loading} onClick={() => { setData(null); void act(async () => { setData(await orgApi.dashboard(view)); }).catch(() => {}); }}>Refresh</Button></div>
    <nav className="org-tabs" aria-label="Company views"><Button variant={tab === "dashboard" ? "primary" : "secondary"} onClick={() => setTab("dashboard")}>Dashboards</Button>
      {setup?.canManage && <Button variant={tab === "organization" ? "primary" : "secondary"} onClick={() => setTab("organization")}>Organization & access</Button>}
      {setup?.canManageIntegrations && <Button variant={tab === "integrations" ? "primary" : "secondary"} onClick={() => setTab("integrations")}>Connected applications</Button>}</nav>
    {error && <Alert tone="danger">{error} Refresh to recheck access.</Alert>}{loading && <p role="status">Loading your authorized scope…</p>}
    {tab === "integrations" && setup?.canManageIntegrations && <IntegrationsPanel />}
    {tab === "dashboard" && <><div className="org-tabs" aria-label="Role dashboards">{(setup?.views ?? ["EMPLOYEE"]).map(v =>
      <Button key={v} variant={view === v ? "primary" : "secondary"} disabled={busy} onClick={() => setView(v)}>{views[v].title}</Button>)}</div>
      <p>{views[view].description}</p>{data && <>
        <p>Calculated {new Date(data.calculatedAt).toLocaleString()}. Only your currently authorized data is included.</p>
        <div className="org-metrics">{[["tasks", "Tasks"], ["completed", "Completed"], ["blocked", "Blocked"], ["overdue", "Overdue"], ["remaining_hours", "Known remaining hours"]].map(([k, label]) =>
          <Card key={k}><span>{label}</span><strong>{String(data.metrics[k])}</strong></Card>)}</div>
        <details><summary>Method and missing data</summary><p>{data.method}</p><p>{String(data.metrics.missing_estimates)} unfinished tasks lack estimates. Last task update: {data.metrics.last_updated ? new Date(String(data.metrics.last_updated)).toLocaleString() : "None"}.</p>
          <p>Lists show up to 100 records; metrics use all authorized records. Missing goals, budgets and availability are not inferred.</p></details>
        {view === "EMPLOYEE" && <DataTable title="My upcoming work" rows={data.tasks} columns={[["title", "Task"], ["project_name", "Project"], ["due_date", "Due"], ["status", "Status"]]} />}
        {view === "MANAGER" && <><DataTable title="Recorded workload by owner" rows={data.workload ?? []} columns={[["name", "Owner (blank means unassigned)"], ["tasks", "Open tasks"], ["estimated_hours", "Estimated hours"], ["missing_estimates", "Missing estimates"]]} />
          <DataTable title="Reporting hierarchy" rows={data.reports ?? []} columns={[["name", "Reports in your hierarchy"]]} /></>}
        {data.teams && <DataTable title="Team delivery" rows={data.teams} columns={[["name", "Team"], ["projects", "Projects"], ["tasks", "Tasks"], ["completed", "Completed"], ["blocked", "Blocked"]]} />}
        {data.departments && <DataTable title="Department delivery" rows={data.departments} columns={[["name", "Department"], ["projects", "Projects"], ["tasks", "Tasks"], ["completed", "Completed"], ["blocked", "Blocked"]]} />}
        {data.resourceGaps && <DataTable title="Department resource gaps" rows={data.resourceGaps} columns={[["name", "Department"], ["unassigned", "Unassigned work"], ["missing_estimates", "Missing estimates"], ["remaining_hours", "Known effort"]]} />}
        {data.dependencies && <DataTable title="Cross-department dependencies" rows={data.dependencies} columns={[["dependent_project", "Dependent project"], ["prerequisite_project", "Prerequisite project"], ["title", "Prerequisite"], ["status", "Status"]]} />}
        {data.projects && <DataTable title="Project portfolio" rows={data.projects} columns={[["name", "Project"], ["tasks", "Tasks"], ["completed", "Completed"], ["blocked", "Blocked"]]} />}
        <DataTable title={view === "EMPLOYEE" ? "Observations affecting my work" : "Risks requiring review"} rows={data.risks} columns={[["title", "Evidence task"], ["project_name", "Project"], ["rule", "Condition"], ["triage_status", "Review"]]} />
        <p>Open Work & insights to inspect task evidence, edit work, or triage observations.</p>
        <Button variant="secondary" onClick={() => setExplore(value => !value)}>{explore ? "Close relationship explorer" : "Explore relationships and trends"}</Button>
        {explore && <OrganizationExplorer />}
      </>}</>}
    {tab === "organization" && setup?.canManage && <>
      <Alert>Administrative access does not automatically grant business data access. Existing projects stay restricted until their owner changes the project audience in Work & insights.</Alert>
      <div className="org-grid">
        <AdminForm title="Department" busy={busy} fields={[{ name: "name", label: "Department name" }]} submit={b => save("departments", b)} />
        <AdminForm title="Team" busy={busy} fields={[{ name: "name", label: "Team name" }, { name: "departmentId", label: "Department", options: options(setup.departments) }]} submit={b => save("teams", b)} />
        <AdminForm title="Team membership" busy={busy} fields={[{ name: "teamId", label: "Team", options: options(setup.teams) }, { name: "userId", label: "Member", options: options(setup.users) }]} submit={b => save("memberships", { ...b, revoke: false })} />
        <AdminForm title="Reporting relationship" busy={busy} fields={[{ name: "employeeId", label: "Employee", options: options(setup.users) }, { name: "managerId", label: "Manager", options: options(setup.users) }]} submit={b => save("reporting", { ...b, revoke: false })} />
      </div>
      <Card><h2>Active memberships</h2><ul className="org-list">{setup.memberships?.map(m => <li key={String(m.id)}>{String(person(m.user_id))} · {String(setup.teams?.find(t => t.id === m.team_id)?.name)}
        <Button variant="secondary" disabled={busy} onClick={() => void save("memberships", { userId: m.user_id, teamId: m.team_id, revoke: true }).catch(() => {})}>Remove membership</Button></li>)}</ul>
        <h2>Reporting relationships</h2><ul className="org-list">{setup.reporting?.map(r => <li key={String(r.id)}>{String(person(r.employee_id))} reports to {String(person(r.manager_id))}
          <Button variant="secondary" disabled={busy} onClick={() => void save("reporting", { employeeId: r.employee_id, managerId: r.manager_id, revoke: true }).catch(() => {})}>Remove relationship</Button></li>)}</ul></Card>
      <Card><h2>Configurable roles</h2><p>Changes apply to all active grants of that role. Earlier role decisions remain in the audit history.</p>
        {setup.roles?.map(r => <details key={`${r.id}-${r.version}`}><summary>{r.name} <Badge>{r.dashboard}</Badge></summary><RoleForm role={r} busy={busy} save={(body, id) => save(`roles/${encodeURIComponent(id!)}`, body, "PUT")} /></details>)}
        <details><summary>Create a custom role</summary><RoleForm busy={busy} save={body => save("roles", body)} /></details></Card>
      <AdminForm title="Scoped role grant" busy={busy} fields={[
        { name: "userId", label: "Member", options: options(setup.users) },
        { name: "roleId", label: "Role", options: setup.roles?.map(r => ({ id: r.id, name: r.name })) ?? [] },
        { name: "scope", label: "Scope", options: ["TEAM", "DEPARTMENT", "COMPANY"].map(id => ({ id, name: id })) },
        { name: "teamId", label: "Team (team scope only)", optional: true, options: options(setup.teams) },
        { name: "departmentId", label: "Department (department scope only)", optional: true, options: options(setup.departments) },
      ]} submit={b => save("bindings", { ...b, teamId: b.scope === "TEAM" ? b.teamId : null, departmentId: b.scope === "DEPARTMENT" ? b.departmentId : null })} />
      <Card><h2>Active role grants</h2><ul className="org-list">{setup.bindings?.map(b => <li key={String(b.id)}>{String(person(b.user_id))} · {setup.roles?.find(r => r.id === b.role_id)?.name} · {String(b.scope)} {String(setup.teams?.find(t => t.id === b.team_id)?.name ?? setup.departments?.find(d => d.id === b.department_id)?.name ?? "")}
        <Button variant="secondary" disabled={busy} onClick={() => void save(`bindings/${encodeURIComponent(String(b.id))}`, undefined, "DELETE").catch(() => {})}>Revoke role</Button></li>)}</ul></Card>
      <details><summary>Create a workspace member</summary><p>This creates an account, without sending email. Organizational roles are assigned separately above.</p>
        <AdminForm title="Workspace member" busy={busy} fields={[{ name: "name", label: "Name" }, { name: "email", label: "Email", type: "email" }, { name: "password", label: "Initial password (8+ characters)", type: "password" }]}
          submit={b => act(() => request("/users/invite", { method: "POST", body: { ...b, role: "employee" } }))} /></details>
      <Button disabled={busy} variant="secondary" onClick={() => void act(async () => setAudit(await orgApi.audit())).catch(() => {})}>Load audit history</Button>
      {audit && <DataTable title="Latest 100 administrative events" rows={audit} columns={[["kind", "Action"], ["actor_id", "Actor"], ["occurred_at", "Time"], ["payload", "Details"]]} />}
    </>}
  </section>;
}
