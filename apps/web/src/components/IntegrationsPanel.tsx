"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { orgApi, type Catalog, type DataRow } from "@/lib/organization-api";
import { DataTable } from "./OrganizationWorkspace";
import { workApi, type WorkProject, type WorkTask } from "@/lib/work-api";

const shareableRecordKinds = ["ISSUE", "TASK", "PULL_REQUEST", "MESSAGE", "DEAL", "INVOICE", "EMPLOYEE", "MARKETING_METRIC"];

export default function IntegrationsPanel() {
  const [catalog, setCatalog] = useState<Catalog | null>(null); const [connections, setConnections] = useState<DataRow[]>([]);
  const [provider, setProvider] = useState("github"); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [oauthMessage, setOauthMessage] = useState("");
  const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<DataRow | null>(null);
  const [records, setRecords] = useState<DataRow[]>([]); const [runs, setRuns] = useState<DataRow[]>([]); const [offset, setOffset] = useState(0);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [xeroTenants, setXeroTenants] = useState<Record<string, DataRow[]>>({});
  const [tenantChoice, setTenantChoice] = useState<Record<string, string>>({});
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
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration") === "xero" && params.get("oauth") === "success") setOauthMessage("Xero authorization succeeded. Choose the organization to sync.");
    if (params.get("integration") === "googleanalytics" && params.get("oauth") === "success") setOauthMessage("Google Analytics authorization succeeded. The connection is ready for its first sync.");
    if (["xero", "googleanalytics"].includes(params.get("integration") ?? "") && params.get("oauth") === "error") setOauthMessage("Authorization did not complete. Review the connection and try again.");
  }, []);
  async function action(fn: () => Promise<void>) { setBusy(true); setError(""); setSelected(null); setRecords([]); setRuns([]);
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function inspect(c: DataRow, page = 0) {
    const [r, s] = await Promise.all([orgApi.records(String(c.id), page), orgApi.runs(String(c.id))]);
    setSelected(c); setOffset(page); setRecords(r); setRuns(s);
  }
  const capability = catalog?.providers.find(p => p.id === provider);
  return <div className="org-stack" aria-busy={busy || loading}>
    {error && <Alert tone="danger">{error}</Alert>}{oauthMessage && <Alert tone={oauthMessage.includes("succeeded") ? "success" : "warning"}>{oauthMessage}</Alert>}{loading && <p role="status">Loading connections…</p>}
    {catalog && !catalog.canManage && <Alert>Integration management permission is required.</Alert>}
    {catalog?.canManage && <>
      <Alert>Connections are private to their creator. Work records become visible to a project only when you explicitly link or import them. Connect only accounts and resources you are authorized to import and share.</Alert>
      {!catalog.credentialStorageReady && <Alert tone="warning">You can save connection settings now. Before adding credentials, configure the server’s INTEGRATION_ENCRYPTION_KEY. See the integration setup guide.</Alert>}
      <Card><h2>Add a connection</h2><form className="org-form" onSubmit={e => {
        e.preventDefault(); const form = e.currentTarget; const b = Object.fromEntries(new FormData(form).entries());
        void action(async () => {
          if (provider === "xero") {
            const connection = await orgApi.createConnection({ ...b, provider, resource: "", accountId: "", token: null });
            const result = await orgApi.startXeroOAuth(connection.id); window.location.assign(result.authorizationUrl); return;
          }
          if (provider === "googleanalytics") {
            const connection = await orgApi.createConnection({ ...b, provider, token: null });
            const result = await orgApi.startGoogleAnalyticsOAuth(connection.id); window.location.assign(result.authorizationUrl); return;
          }
          await orgApi.createConnection({ ...b, provider }); form.reset();
        });
      }}>
        <Field label="Provider">{f => <Select {...f} disabled={busy} value={provider} onChange={e => setProvider(e.target.value)}>
          {catalog.providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</Field>
        <Field label="Connection name">{f => <Input {...f} name="name" required maxLength={200} disabled={busy} />}</Field>
        {provider !== "xero" && <Field label={capability?.resourceLabel ?? "Resource"}>{f => <Input {...f} key={provider} name="resource" required maxLength={200} disabled={busy} />}</Field>}
        {provider !== "xero" && capability?.accountLabel && <Field label={capability.accountLabel}>{f => <Input {...f} name="accountId" required maxLength={100} disabled={busy} />}</Field>}
        {!(["xero", "googleanalytics"].includes(provider)) && <Field label="Credential (optional for now)" hint="Stored encrypted on the server. Never displayed again.">{f => <Input {...f} name="token" type="password" autoComplete="new-password" disabled={busy || !catalog.credentialStorageReady} />}</Field>}
        {provider === "xero" && <p>Xero opens its authorization page. You will choose which authorized organization to sync after returning to Kiro. Tokens stay encrypted on the server.</p>}
        {provider === "googleanalytics" && <p>Google opens its authorization page for read-only Analytics access. The property ID identifies the report; OAuth tokens stay encrypted on the server.</p>}
        <p>{capability?.entities}</p><p>Required access: {capability?.permissions}</p><p>{capability?.sync}</p>
        <Button type="submit" disabled={busy || (provider === "xero" && (!catalog.credentialStorageReady || !catalog.xeroOAuthConfigured)) || (provider === "googleanalytics" && (!catalog.credentialStorageReady || !catalog.googleAnalyticsOAuthConfigured))}>{provider === "xero" ? catalog.xeroOAuthConfigured ? "Authorize Xero" : "Xero authorization not configured" : provider === "googleanalytics" ? catalog.googleAnalyticsOAuthConfigured ? "Authorize Google Analytics" : "Google Analytics authorization not configured" : "Save connection"}</Button>
      </form></Card>
      <div className="org-heading"><h2>Your connections</h2><Button variant="secondary" disabled={busy} onClick={() => void action(async () => {})}>Refresh connections</Button></div>
      {!connections.length && <p>No connections configured. No external synchronization has occurred.</p>}
      {connections.map(c => <Card key={String(c.id)}><h3>{String(c.name)}</h3><Badge tone={c.status === "READY" ? "success" : c.status === "DELETED" ? "neutral" : "warning"}>{String(c.status)}</Badge>
        <p>{String(c.provider)} · {c.resource ? String(c.resource) : c.status === "OAUTH_TENANT" ? "Choose an authorized organization" : "No organization selected"}</p><p>Last complete sync: {c.last_success_at ? new Date(String(c.last_success_at)).toLocaleString() : "Never"}.</p>
        {c.last_error && <Alert tone="warning">{String(c.last_error)}. Correct permissions or replace the credential to restart.</Alert>}
        {c.status === "OAUTH_AUTHORIZING" && <p role="status">Authorization is waiting for consent. Complete the provider page, then return here.</p>}
        <p>Records appear only after a complete successful scan and are withheld after errors, disconnects, or 24 hours without success. Multi-page scans continue automatically; Refresh connections checks progress.</p>
        <div className="org-tabs"><Button disabled={busy || ["UNCONFIGURED", "DISCONNECTED", "FAILED", "REAUTH", "DELETED"].includes(String(c.status))}
          onClick={() => void action(async () => { await orgApi.sync(String(c.id)); })}>Synchronize next page</Button>
          <Button variant="secondary" disabled={busy} onClick={() => void action(() => inspect(c))}>Inspect records & runs</Button>
          {c.provider === "xero" && ["REAUTH", "DISCONNECTED"].includes(String(c.status)) && <Button variant="secondary" disabled={busy || !catalog.xeroOAuthConfigured || !catalog.credentialStorageReady} onClick={() => void action(async () => { const result = await orgApi.startXeroOAuth(String(c.id)); window.location.assign(result.authorizationUrl); })}>Reconnect Xero</Button>}
          {c.provider === "googleanalytics" && ["REAUTH", "DISCONNECTED"].includes(String(c.status)) && <Button variant="secondary" disabled={busy || !catalog.googleAnalyticsOAuthConfigured || !catalog.credentialStorageReady} onClick={() => void action(async () => { const result = await orgApi.startGoogleAnalyticsOAuth(String(c.id)); window.location.assign(result.authorizationUrl); })}>Reconnect Google Analytics</Button>}
          <Button variant="secondary" disabled={busy || ["DISCONNECTED", "DELETED"].includes(String(c.status))} onClick={() => setDisconnecting(String(c.id))}>Disconnect</Button>
          <Button variant="danger" disabled={busy || c.status === "DELETED"} onClick={() => setDeleting(String(c.id))}>Delete connection data</Button></div>
        {disconnecting === c.id && <Alert tone="warning">Disconnect removes the stored credential and hides imported records. Historical rows remain in storage.
          <div className="org-tabs"><Button variant="danger" disabled={busy} onClick={() => void action(async () => { await orgApi.disconnect(String(c.id)); setDisconnecting(null); })}>Confirm disconnect</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setDisconnecting(null)}>Cancel</Button></div></Alert>}
        {deleting === c.id && <Alert tone="danger">Permanently delete this connection and its imported records, facts, and source links? A minimal audit tombstone will remain; this cannot be undone.
          <div className="org-tabs"><Button variant="danger" disabled={busy} onClick={() => void action(async () => { await orgApi.deleteConnectionData(String(c.id)); setDeleting(null); })}>Permanently delete data</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button></div></Alert>}
        {c.status === "OAUTH_TENANT" && <Card><h3>Choose a Xero organization</h3><p>The authorized organizations belong to this connection owner. Selecting one starts read-only invoice synchronization.</p>
          {!xeroTenants[String(c.id)] ? <Button variant="secondary" disabled={busy} onClick={() => void action(async () => { const rows = await orgApi.xeroTenants(String(c.id)); setXeroTenants(current => ({ ...current, [String(c.id)]: rows })); })}>Load authorized organizations</Button> :
            <form className="org-form" onSubmit={e => { e.preventDefault(); const selected = tenantChoice[String(c.id)]; void action(async () => { await orgApi.selectXeroTenant(String(c.id), selected); }); }}>
              <Field label="Xero organization">{f => <Select {...f} required value={tenantChoice[String(c.id)] ?? ""} disabled={busy} onChange={e => setTenantChoice(current => ({ ...current, [String(c.id)]: e.target.value }))}>
                <option value="">Select organization</option>{xeroTenants[String(c.id)].map(t => <option key={String(t.xero_tenant_id)} value={String(t.xero_tenant_id)}>{String(t.tenant_name)}</option>)}</Select>}</Field>
              <Button type="submit" disabled={busy || !tenantChoice[String(c.id)]}>Confirm organization and sync invoices</Button>
            </form>}
        </Card>}
        {c.status !== "DELETED" && !["xero", "googleanalytics"].includes(String(c.provider)) && <details><summary>Add or replace credential</summary><form className="org-form" onSubmit={e => {
          e.preventDefault(); const form = e.currentTarget; const token = String(new FormData(form).get("token"));
          void action(async () => { await orgApi.credential(String(c.id), token); form.reset(); });
        }}><Field label={`New credential for ${String(c.name)}`}>{f => <Input {...f} name="token" type="password" autoComplete="new-password" required disabled={busy || !catalog.credentialStorageReady} />}</Field>
          <Button type="submit" disabled={busy || !catalog.credentialStorageReady}>Save credential & restart sync</Button></form></details>}
      </Card>)}
      {selected && <Card><h2>{String(selected.name)} — imported records</h2>
        {!records.length && <p>No current records on this page. The connection may be unconfigured, synchronizing, stale, or empty.</p>}
        <ul className="org-list">{records.map(r => <li key={String(r.id)}><div><Badge>{String(r.kind)}</Badge><h3>{String(r.title)}</h3>
          <p>{r.status ? String(r.status) : "Status not supplied"} · Observed {new Date(String(r.observed_at)).toLocaleString()}</p>
          {r.amount != null && <p>Recorded amount: {String(r.amount)} {r.currency ? String(r.currency) : "(currency not supplied)"}</p>}
          {r.department && <p>Department: {String(r.department)}. Supervisor reference: {String(r.supervisor_reference ?? "Not supplied")}.</p>}
          {r.metric && <p>{String(r.metric)}: {String(r.metric_value)} {String(r.metric_currency ?? r.unit)} · {String(r.period_start)} through {String(r.period_end)}. Campaign attribution: {String(r.campaign)}.</p>}
          {r.source_url && <a href={String(r.source_url)} target="_blank" rel="noreferrer">Open provider source</a>}
          {shareableRecordKinds.includes(String(r.kind)) && <Button variant="secondary" disabled={busy} onClick={() => void action(() => startMapping(r))}>Share record with project work</Button>}</div></li>)}</ul>
        <div className="org-tabs"><Button variant="secondary" disabled={busy || !offset} onClick={() => void action(() => inspect(selected, offset - 100))}>Previous records</Button>
          <Button variant="secondary" disabled={busy || records.length < 100} onClick={() => void action(() => inspect(selected, offset + 100))}>Next records</Button></div>
        <DataTable title="Recent synchronization runs" rows={runs} columns={[["status", "Status"], ["records_seen", "Records observed"], ["started_at", "Started"], ["finished_at", "Finished"], ["error_code", "Error"]]} />
      </Card>}
      {mapping && <Card><h2>Share a provider record with project work</h2><p><Badge>{String(mapping.kind)}</Badge> {String(mapping.title)}</p>
        {mapping.amount != null && <p>Financial snapshot: {String(mapping.amount)} {mapping.currency ? String(mapping.currency) : "currency not supplied"}. The amount keeps its source currency; it is not converted or combined with other currencies.</p>}
        {mapping.department && <p>Employee snapshot: {String(mapping.department)} department · supervisor {String(mapping.supervisor_reference ?? "not supplied")}.</p>}
        {mapping.metric && <p>Marketing snapshot: {String(mapping.metric)} {String(mapping.metric_value)} {String(mapping.metric_currency ?? mapping.unit)} · {String(mapping.period_start)} through {String(mapping.period_end)} · campaign {String(mapping.campaign)}.</p>}
        <p>Confirming shares this source snapshot with everyone who can read the selected project, including future project members. New tasks start as unassigned TODO work with no guessed effort or deadline. Linking does not edit existing tasks.</p>
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
