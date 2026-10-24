"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { orgApi, type Catalog, type DataRow } from "@/lib/organization-api";
import { DataTable } from "./OrganizationWorkspace";
import { workApi, type WorkProject, type WorkTask } from "@/lib/work-api";

export default function IntegrationsPanel() {
  const [catalog, setCatalog] = useState<Catalog | null>(null); const [connections, setConnections] = useState<DataRow[]>([]);
  const [provider, setProvider] = useState("github"); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<DataRow | null>(null);
  const [records, setRecords] = useState<DataRow[]>([]); const [runs, setRuns] = useState<DataRow[]>([]); const [offset, setOffset] = useState(0);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [mapping, setMapping] = useState<DataRow | null>(null);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [projectPage, setProjectPage] = useState(0);
  async function startMapping(record: DataRow, page = 0) {
    setMapping(record); setProjectId(""); setTasks([]); setProjectPage(page);
    setProjects(await workApi.projects(page));
  }
  const load = useCallback(async () => {
    const c = await orgApi.catalog(); setCatalog(c); setConnections(c.canManage ? await orgApi.connections() : []);
  }, []);
  useEffect(() => { let active = true;
    orgApi.catalog().then(async c => { const list = c.canManage ? await orgApi.connections() : []; if (active) { setCatalog(c); setConnections(list); } })
      .catch(e => { if (active) setError((e as Error).message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function action(fn: () => Promise<void>) { setBusy(true); setError(""); setSelected(null); setRecords([]); setRuns([]);
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function inspect(c: DataRow, page = 0) {
    const [r, s] = await Promise.all([orgApi.records(String(c.id), page), orgApi.runs(String(c.id))]);
    setSelected(c); setOffset(page); setRecords(r); setRuns(s);
  }
  const capability = catalog?.providers.find(p => p.id === provider);
  return <div className="org-stack" aria-busy={busy || loading}>
    {error && <Alert tone="danger">{error}</Alert>}{loading && <p role="status">Loading connections…</p>}
    {catalog && !catalog.canManage && <Alert>Integration management permission is required.</Alert>}
    {catalog?.canManage && <>
      <Alert>Connections are private to their creator. Work records become visible to a project only when you explicitly link or import them. Connect only accounts and resources you are authorized to import and share.</Alert>
      {!catalog.credentialStorageReady && <Alert tone="warning">You can save connection settings now. Before adding credentials, configure the server’s INTEGRATION_ENCRYPTION_KEY. See the integration setup guide.</Alert>}
      <Card><h2>Add a connection</h2><form className="org-form" onSubmit={e => {
        e.preventDefault(); const form = e.currentTarget; const b = Object.fromEntries(new FormData(form).entries());
        void action(async () => { await orgApi.createConnection({ ...b, provider }); form.reset(); });
      }}>
        <Field label="Provider">{f => <Select {...f} disabled={busy} value={provider} onChange={e => setProvider(e.target.value)}>
          {catalog.providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</Field>
        <Field label="Connection name">{f => <Input {...f} name="name" required maxLength={200} disabled={busy} />}</Field>
        <Field label={capability?.resourceLabel ?? "Resource"}>{f => <Input {...f} key={provider} name="resource" required maxLength={200} disabled={busy} />}</Field>
        {capability?.accountLabel && <Field label={capability.accountLabel}>{f => <Input {...f} name="accountId" required maxLength={100} disabled={busy} />}</Field>}
        <Field label="Credential (optional for now)" hint="Stored encrypted on the server. Never displayed again.">{f => <Input {...f} name="token" type="password" autoComplete="new-password" disabled={busy || !catalog.credentialStorageReady} />}</Field>
        <p>{capability?.entities}</p><p>Required access: {capability?.permissions}</p><p>{capability?.sync}</p>
        <Button type="submit" disabled={busy}>Save connection</Button>
      </form></Card>
      <div className="org-heading"><h2>Your connections</h2><Button variant="secondary" disabled={busy} onClick={() => void action(async () => {})}>Refresh connections</Button></div>
      {!connections.length && <p>No connections configured. No external synchronization has occurred.</p>}
      {connections.map(c => <Card key={String(c.id)}><h3>{String(c.name)}</h3><Badge tone={c.status === "READY" ? "success" : "warning"}>{String(c.status)}</Badge>
        <p>{String(c.provider)} · {String(c.resource)}</p><p>Last complete sync: {c.last_success_at ? new Date(String(c.last_success_at)).toLocaleString() : "Never"}.</p>
        {c.last_error && <Alert tone="warning">{String(c.last_error)}. Correct permissions or replace the credential to restart.</Alert>}
        <p>Records appear only after a complete successful scan and are withheld after errors, disconnects, or 24 hours without success. Multi-page scans continue automatically; Refresh connections checks progress.</p>
        <div className="org-tabs"><Button disabled={busy || ["UNCONFIGURED", "DISCONNECTED", "FAILED", "REAUTH"].includes(String(c.status))}
          onClick={() => void action(async () => { await orgApi.sync(String(c.id)); })}>Synchronize next page</Button>
          <Button variant="secondary" disabled={busy} onClick={() => void action(() => inspect(c))}>Inspect records & runs</Button>
          <Button variant="secondary" disabled={busy || c.status === "DISCONNECTED"} onClick={() => setDisconnecting(String(c.id))}>Disconnect</Button></div>
        {disconnecting === c.id && <Alert tone="warning">Disconnect removes the stored credential and hides imported records. Historical rows remain in storage.
          <div className="org-tabs"><Button variant="danger" disabled={busy} onClick={() => void action(async () => { await orgApi.disconnect(String(c.id)); setDisconnecting(null); })}>Confirm disconnect</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setDisconnecting(null)}>Cancel</Button></div></Alert>}
        <details><summary>Add or replace credential</summary><form className="org-form" onSubmit={e => {
          e.preventDefault(); const form = e.currentTarget; const token = String(new FormData(form).get("token"));
          void action(async () => { await orgApi.credential(String(c.id), token); form.reset(); });
        }}><Field label={`New credential for ${String(c.name)}`}>{f => <Input {...f} name="token" type="password" autoComplete="new-password" required disabled={busy || !catalog.credentialStorageReady} />}</Field>
          <Button type="submit" disabled={busy || !catalog.credentialStorageReady}>Save credential & restart sync</Button></form></details>
      </Card>)}
      {selected && <Card><h2>{String(selected.name)} — imported records</h2>
        {!records.length && <p>No current records on this page. The connection may be unconfigured, synchronizing, stale, or empty.</p>}
        <ul className="org-list">{records.map(r => <li key={String(r.id)}><div><Badge>{String(r.kind)}</Badge><h3>{String(r.title)}</h3>
          <p>{r.status ? String(r.status) : "Status not supplied"} · Observed {new Date(String(r.observed_at)).toLocaleString()}</p>
          {r.amount !== null && <p>Recorded amount: {String(r.amount)} {r.currency ? String(r.currency) : "(currency not supplied)"}</p>}
          {r.department && <p>Department: {String(r.department)}. Supervisor reference: {String(r.supervisor_reference ?? "Not supplied")}.</p>}
          {r.source_url && <a href={String(r.source_url)} target="_blank" rel="noreferrer">Open provider source</a>}
          {["ISSUE", "TASK", "PULL_REQUEST", "MESSAGE"].includes(String(r.kind)) && <Button variant="secondary" disabled={busy} onClick={() => void action(() => startMapping(r))}>Link to project work</Button>}</div></li>)}</ul>
        <div className="org-tabs"><Button variant="secondary" disabled={busy || !offset} onClick={() => void action(() => inspect(selected, offset - 100))}>Previous records</Button>
          <Button variant="secondary" disabled={busy || records.length < 100} onClick={() => void action(() => inspect(selected, offset + 100))}>Next records</Button></div>
        <DataTable title="Recent synchronization runs" rows={runs} columns={[["status", "Status"], ["records_seen", "Records observed"], ["started_at", "Started"], ["finished_at", "Finished"], ["error_code", "Error"]]} />
      </Card>}
      {mapping && <Card><h2>Share work with a project</h2><p>{String(mapping.title)}</p>
        <p>This shares a source snapshot with everyone who can read the selected project, including future project members. New tasks start as unassigned TODO work with no guessed effort or deadline. Linking does not edit existing tasks.</p>
        <form className="org-form" onSubmit={e => {
          e.preventDefault(); const body = Object.fromEntries(new FormData(e.currentTarget).entries());
          void action(async () => { await orgApi.mapSource(projectId, { recordId: mapping.id, taskId: body.taskId || null, rationale: body.rationale, shareWithProject: body.share === "on" }); setMapping(null); });
        }}>
          <Field label="Target project">{f => <Select {...f} required value={projectId} disabled={busy} onChange={e => {
            const id = e.target.value; setProjectId(id); setTasks([]);
            if (id) void action(async () => { const d = await workApi.detail(id); if (!d.project.can_write) { setProjectId(""); throw new Error("Write access is required for the target project."); } setTasks(d.tasks); });
          }}><option value="">Select project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</Field>
          <div className="org-tabs"><Button variant="secondary" disabled={busy || projectPage === 0} onClick={() => void action(() => startMapping(mapping, projectPage - 100))}>Previous projects</Button><Button variant="secondary" disabled={busy || projects.length < 100} onClick={() => void action(() => startMapping(mapping, projectPage + 100))}>Next projects</Button></div>
          <Field label="Target task" hint="Lists the first 100 tasks in this project.">{f => <Select {...f} name="taskId" disabled={busy || !projectId}><option value="">Create a new task from this source</option>{tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</Select>}</Field>
          <Field label="Why these records represent the same work">{f => <Input {...f} name="rationale" required maxLength={1000} disabled={busy} />}</Field>
          <label className="org-check"><input type="checkbox" name="share" required disabled={busy} />I am authorized to share this record with the project audience.</label>
          <div className="org-tabs"><Button type="submit" disabled={busy || !projectId}>Confirm sharing and link</Button><Button variant="secondary" disabled={busy} onClick={() => setMapping(null)}>Cancel</Button></div>
        </form>
      </Card>}
    </>}
  </div>;
}
