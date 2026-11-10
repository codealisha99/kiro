"use client";
import { useState } from "react";
import { Alert, Badge, Button, Field, Input, Panel, Section, Select } from "@/components/ui";
import { request } from "@/lib/api";
import { orgApi, type DashboardView, type DataRow, type OrgRole, type OrgSetup } from "@/lib/organization-api";
import { DataTable } from "./DataTable";

const SCOPE_OPTIONS = ["TEAM", "DEPARTMENT", "COMPANY"];
const PERMISSIONS = ["PROJECT_READ", "PROJECT_WRITE", "ORG_MANAGE", "INTEGRATION_MANAGE"];
const DASHBOARDS: (DashboardView | "ADMIN")[] = ["EMPLOYEE", "MANAGER", "DIRECTOR", "VP", "CEO", "ADMIN"];

interface FormField { name: string; label: string; options?: { id: string; name: string }[]; optional?: boolean; type?: string }

function options(rows: DataRow[] | undefined) {
  return (rows ?? []).map((r) => ({ id: String(r.id), name: String(r.name ?? r.email ?? r.id) }));
}

function AdminForm({ title, fields, submit, busy }: { title: string; fields: FormField[]; submit: (data: Record<string, string>) => Promise<void>; busy: boolean }) {
  return (
    <Panel className="org-setup-form">
      <h3>{title}</h3>
      <form className="org-form" onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
        void submit(data).then(() => form.reset()).catch(() => {});
      }}>
        {fields.map((item) => (
          <Field key={item.name} label={item.label}>{(f) => item.options ? (
            <Select {...f} name={item.name} required={!item.optional} disabled={busy} defaultValue="">
              <option value="">Choose…</option>
              {item.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          ) : (
            <Input {...f} name={item.name} type={item.type ?? "text"} autoComplete={item.type === "password" ? "new-password" : "off"} maxLength={200} required={!item.optional} disabled={busy} />
          )}</Field>
        ))}
        <Button type="submit" disabled={busy}>Save {title.toLowerCase()}</Button>
      </form>
    </Panel>
  );
}

function RoleForm({ role, busy, save }: { role?: OrgRole; busy: boolean; save: (body: unknown, id?: string) => Promise<void> }) {
  return (
    <form className="org-form" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const data = new FormData(form);
      void save({ name: data.get("name"), dashboard: data.get("dashboard"), permissions: data.getAll("permission"), expectedVersion: role?.version }, role?.id)
        .then(() => { if (!role) form.reset(); }).catch(() => {});
    }}>
      <Field label="Role name">{(f) => <Input {...f} name="name" required maxLength={100} defaultValue={role?.name} disabled={busy} />}</Field>
      <Field label="Dashboard">{(f) => (
        <Select {...f} name="dashboard" defaultValue={role?.dashboard ?? "EMPLOYEE"} disabled={busy}>
          {DASHBOARDS.map((v) => <option key={v}>{v}</option>)}
        </Select>
      )}</Field>
      <fieldset disabled={busy} className="org-permissions">
        <legend>Granted permissions</legend>
        {PERMISSIONS.map((p) => (
          <label className="org-check" key={p}>
            <input type="checkbox" name="permission" value={p} defaultChecked={role?.permissions.includes(p)} />
            {p.replaceAll("_", " ").toLowerCase()}
          </label>
        ))}
      </fieldset>
      <p className="org-muted">Write requires read. Organization and integration management apply only to company-scoped grants. Dashboard choice alone grants no data access.</p>
      <Button type="submit" disabled={busy}>{role ? "Update role" : "Create role"}</Button>
    </form>
  );
}

// Administrative setup: structure, memberships, roles, and audit. Every write reloads setup through `act`.
export default function OrganizationSetup({ setup, busy, act }: { setup: OrgSetup; busy: boolean; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [audit, setAudit] = useState<DataRow[] | null>(null);
  const save = (path: string, body: unknown, method = "POST") => act(() => orgApi.save(path, body, method));
  const person = (id: unknown) => setup.users?.find((u) => u.id === id)?.name ?? id;
  return (
    <>
      <Alert>Administrative access does not automatically grant business data access. Existing projects stay restricted until their owner changes the project audience in Work &amp; insights.</Alert>
      <Section title="Structure" description="Departments, teams, membership, and reporting lines.">
        <div className="org-grid">
          <AdminForm title="Department" busy={busy} fields={[{ name: "name", label: "Department name" }]} submit={(b) => save("departments", b)} />
          <AdminForm title="Team" busy={busy} fields={[{ name: "name", label: "Team name" }, { name: "departmentId", label: "Department", options: options(setup.departments) }]} submit={(b) => save("teams", b)} />
          <AdminForm title="Team membership" busy={busy} fields={[{ name: "teamId", label: "Team", options: options(setup.teams) }, { name: "userId", label: "Member", options: options(setup.users) }]} submit={(b) => save("memberships", { ...b, revoke: false })} />
          <AdminForm title="Reporting relationship" busy={busy} fields={[{ name: "employeeId", label: "Employee", options: options(setup.users) }, { name: "managerId", label: "Manager", options: options(setup.users) }]} submit={(b) => save("reporting", { ...b, revoke: false })} />
        </div>
        <Panel className="org-setup-list">
          <h3>Active memberships</h3>
          <ul className="org-list">{setup.memberships?.map((m) => (
            <li key={String(m.id)}>
              <span>{String(person(m.user_id))} · {String(setup.teams?.find((t) => t.id === m.team_id)?.name)}</span>
              <Button variant="secondary" size="small" disabled={busy} onClick={() => void save("memberships", { userId: m.user_id, teamId: m.team_id, revoke: true }).catch(() => {})}>Remove membership</Button>
            </li>
          ))}</ul>
          <h3>Reporting relationships</h3>
          <ul className="org-list">{setup.reporting?.map((r) => (
            <li key={String(r.id)}>
              <span>{String(person(r.employee_id))} reports to {String(person(r.manager_id))}</span>
              <Button variant="secondary" size="small" disabled={busy} onClick={() => void save("reporting", { employeeId: r.employee_id, managerId: r.manager_id, revoke: true }).catch(() => {})}>Remove relationship</Button>
            </li>
          ))}</ul>
        </Panel>
      </Section>
      <Section title="Roles and grants" description="Changes apply to all active grants of that role. Earlier role decisions remain in the audit history.">
        <Panel>
          <h3>Configurable roles</h3>
          {setup.roles?.map((r) => (
            <details key={`${r.id}-${r.version}`} className="org-disclosure">
              <summary>{r.name} <Badge>{r.dashboard}</Badge></summary>
              <RoleForm role={r} busy={busy} save={(body, id) => save(`roles/${encodeURIComponent(id!)}`, body, "PUT")} />
            </details>
          ))}
          <details className="org-disclosure">
            <summary>Create a custom role</summary>
            <RoleForm busy={busy} save={(body) => save("roles", body)} />
          </details>
        </Panel>
        <AdminForm
          title="Scoped role grant"
          busy={busy}
          fields={[
            { name: "userId", label: "Member", options: options(setup.users) },
            { name: "roleId", label: "Role", options: setup.roles?.map((r) => ({ id: r.id, name: r.name })) ?? [] },
            { name: "scope", label: "Scope", options: SCOPE_OPTIONS.map((id) => ({ id, name: id })) },
            { name: "teamId", label: "Team (team scope only)", optional: true, options: options(setup.teams) },
            { name: "departmentId", label: "Department (department scope only)", optional: true, options: options(setup.departments) },
          ]}
          submit={(b) => save("bindings", { ...b, teamId: b.scope === "TEAM" ? b.teamId : null, departmentId: b.scope === "DEPARTMENT" ? b.departmentId : null })}
        />
        <Panel className="org-setup-list">
          <h3>Active role grants</h3>
          <ul className="org-list">{setup.bindings?.map((b) => (
            <li key={String(b.id)}>
              <span>{String(person(b.user_id))} · {setup.roles?.find((r) => r.id === b.role_id)?.name} · {String(b.scope)} {String(setup.teams?.find((t) => t.id === b.team_id)?.name ?? setup.departments?.find((d) => d.id === b.department_id)?.name ?? "")}</span>
              <Button variant="secondary" size="small" disabled={busy} onClick={() => void save(`bindings/${encodeURIComponent(String(b.id))}`, undefined, "DELETE").catch(() => {})}>Revoke role</Button>
            </li>
          ))}</ul>
        </Panel>
      </Section>
      <Section title="Members and audit" description="Accounts are created here without sending email. Audit history lists the latest administrative events.">
        <details className="org-disclosure">
          <summary>Create a workspace member</summary>
          <p className="org-muted">This creates an account, without sending email. Organizational roles are assigned separately above.</p>
          <AdminForm title="Workspace member" busy={busy} fields={[{ name: "name", label: "Name" }, { name: "email", label: "Email", type: "email" }, { name: "password", label: "Initial password (8+ characters)", type: "password" }]}
            submit={(b) => act(() => request("/users/invite", { method: "POST", body: { ...b, role: "employee" } }))} />
        </details>
        <div className="org-tabs">
          <Button variant="secondary" disabled={busy} onClick={() => void act(async () => setAudit(await orgApi.audit())).catch(() => {})}>Load audit history</Button>
        </div>
        {audit && <DataTable title="Latest 100 administrative events" rows={audit} columns={[["kind", "Action"], ["actor_id", "Actor"], ["occurred_at", "Time"], ["payload", "Details"]]} />}
      </Section>
    </>
  );
}
