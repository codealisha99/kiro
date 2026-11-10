"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Field, Input, Panel, Section, Select } from "@/components/ui";
import { orgApi, type Catalog, type DataRow } from "@/lib/organization-api";
import { connectionStatus, syncFreshness, type Tone } from "@/lib/organization-model";
import { workApi, type WorkProject, type WorkTask } from "@/lib/work-api";
import { DataTable } from "./DataTable";

const shareableRecordKinds = ["ISSUE", "TASK", "PULL_REQUEST", "MESSAGE", "DEAL", "INVOICE", "EMPLOYEE", "MARKETING_METRIC"];
const oauthProviders = ["xero", "googleanalytics", "googledrive"];
const unavailableStatuses = ["UNCONFIGURED", "DISCONNECTED", "FAILED", "REAUTH", "DELETED"];
const reauthStatuses = ["REAUTH", "DISCONNECTED", "FAILED"];
const providerSetup: Record<string, { resourceHint: string; credentialHint: string; importSummary: string }> = {
  github: { resourceHint: "owner/repository", credentialHint: "Fine-grained token with read access to Issues. Add Pull requests read access to import private pull requests.", importSummary: "Imports issues and pull requests from this repository." },
  linear: { resourceHint: "Linear team UUID", credentialHint: "Linear API key with read access to the selected team.", importSummary: "Imports issues from the selected team." },
  slack: { resourceHint: "Public channel ID, for example C012ABCDEF", credentialHint: "Slack bot token with channels:read and channels:history. Invite the bot to the public channel before syncing.", importSummary: "Imports recent messages and thread replies from one joined public channel. Private channels and direct messages are not included." },
  googledrive: { resourceHint: "Google Drive folder ID. Imports supported files in this folder and nested folders.", credentialHint: "Google opens its authorization page. OAuth tokens are encrypted on the server.", importSummary: "Imports Google Docs, Sheets, Slides, plain text, and text-based PDFs from this folder and nested folders." },
};

// Status is text first; the dot only reinforces it.
function StatusLine({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`org-status tone-${tone}`}><span className="org-status-dot" aria-hidden="true" />{label}</span>;
}

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
  useEffect(() => {
    let active = true;
    orgApi.catalog().then(async (c) => { const list = c.canManage ? await orgApi.connections() : []; if (active) { setCatalog(c); setConnections(list); } })
      .catch((e) => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration") === "xero" && params.get("oauth") === "success") setOauthMessage("Xero authorization succeeded. Choose the organization to sync.");
    if (params.get("integration") === "googleanalytics" && params.get("oauth") === "success") setOauthMessage("Google Analytics authorization succeeded. The connection is ready for its first sync.");
    if (params.get("integration") === "googledrive" && params.get("oauth") === "success") setOauthMessage("Google Drive authorization succeeded. The connection is ready for its first sync.");
    if (oauthProviders.includes(params.get("integration") ?? "") && params.get("oauth") === "error") setOauthMessage("Authorization did not complete. Review the connection and try again.");
  }, []);

  async function action(fn: () => Promise<void>) {
    setBusy(true); setError(""); setSelected(null); setRecords([]); setRuns([]);
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function inspect(c: DataRow, page = 0) {
    const [r, s] = await Promise.all([orgApi.records(String(c.id), page), orgApi.runs(String(c.id))]);
    setSelected(c); setOffset(page); setRecords(r); setRuns(s);
  }
  const capability = catalog?.providers.find((p) => p.id === provider);
  const setup = providerSetup[provider];
  const now = Date.now();
  const xeroBlocked = !catalog?.credentialStorageReady || !catalog?.xeroOAuthConfigured;
  const driveBlocked = !catalog?.credentialStorageReady || !catalog?.googleDriveOAuthConfigured;
  const analyticsBlocked = !catalog?.credentialStorageReady || !catalog?.googleAnalyticsOAuthConfigured;

  return (
    <div className="org-stack" aria-busy={busy || loading}>
      {error && <Alert tone="danger">{error}</Alert>}
      {oauthMessage && <Alert tone={oauthMessage.includes("succeeded") ? "success" : "warning"}>{oauthMessage}</Alert>}
      {loading && <p role="status">Loading connections…</p>}
      {catalog && !catalog.canManage && <Alert>Integration management permission is required.</Alert>}
      {catalog?.canManage && <>
        <Alert>Synced records are searchable in answers only by the connection owner, and only while the connection has fresh successful sync data. Work records become visible to a project only when explicitly linked. Connect only accounts and resources you are authorized to import and share.</Alert>
        {!catalog.credentialStorageReady && <Alert tone="warning">You can save connection settings now. Before adding credentials, configure the server’s INTEGRATION_ENCRYPTION_KEY. See the integration setup guide.</Alert>}

        <Section title="Add a connection" description="Choose a provider. OAuth providers open their consent page; token providers store an encrypted credential.">
          <Panel>
            <form className="org-form" onSubmit={(e) => {
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
                if (provider === "googledrive") {
                  const connection = await orgApi.createConnection({ ...b, provider, token: null });
                  const result = await orgApi.startGoogleDriveOAuth(connection.id); window.location.assign(result.authorizationUrl); return;
                }
                await orgApi.createConnection({ ...b, provider }); form.reset();
              });
            }}>
              <Field label="Provider">{(f) => <Select {...f} disabled={busy} value={provider} onChange={(e) => setProvider(e.target.value)}>
                {catalog.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</Field>
              <Field label="Connection name">{(f) => <Input {...f} name="name" required maxLength={200} disabled={busy} />}</Field>
              {provider !== "xero" && <Field label={capability?.resourceLabel ?? "Resource"} hint={setup?.resourceHint}>{(f) => <Input {...f} key={provider} name="resource" required maxLength={200} disabled={busy} />}</Field>}
              {provider !== "xero" && capability?.accountLabel && <Field label={capability.accountLabel}>{(f) => <Input {...f} name="accountId" required maxLength={100} disabled={busy} />}</Field>}
              {!oauthProviders.includes(provider) && <Field label="Access token" hint={setup?.credentialHint ?? "Stored encrypted on the server and never shown again."}>{(f) => <Input {...f} name="token" type="password" autoComplete="new-password" required disabled={busy || !catalog.credentialStorageReady} />}</Field>}
              {provider === "xero" && <p className="org-muted">Xero opens its authorization page. You will choose which authorized organization to sync after returning to Kiro. Tokens stay encrypted on the server.</p>}
              {provider === "googledrive" && <p className="org-muted">Google opens its authorization page for read-only Drive access. Docs, Sheets, Slides, plain text, and text-based PDFs are imported from the selected folder and nested folders. PDF text extraction covers up to 100 pages. Imported files are searchable only by the connection owner.</p>}
              {provider === "googleanalytics" && <p className="org-muted">Google opens its authorization page for read-only Analytics access. The property ID identifies the report; OAuth tokens stay encrypted on the server.</p>}
              <p>{setup?.importSummary ?? capability?.entities}</p><p className="org-muted">Required access: {capability?.permissions}</p><p className="org-muted">{capability?.sync}</p>
              <Button type="submit" disabled={busy || (provider === "xero" && xeroBlocked) || (provider === "googleanalytics" && analyticsBlocked) || (provider === "googledrive" && driveBlocked)}>
                {provider === "xero" ? catalog.xeroOAuthConfigured ? "Authorize Xero" : "Xero authorization not configured"
                  : provider === "googleanalytics" ? catalog.googleAnalyticsOAuthConfigured ? "Authorize Google Analytics" : "Google Analytics authorization not configured"
                  : provider === "googledrive" ? catalog.googleDriveOAuthConfigured ? "Authorize Google Drive" : "Google Drive authorization not configured"
                  : "Connect and save"}
              </Button>
            </form>
          </Panel>
        </Section>

        <Section title="Your connections" description="Status, freshness, and coverage come from the last sync run. Records appear only after a complete successful scan." actions={<Button variant="secondary" disabled={busy} onClick={() => void action(async () => {})}>Refresh connections</Button>}>
          {!connections.length && <p className="org-empty">No connections configured. No external synchronization has occurred.</p>}
          <div className="org-connections">
            {connections.map((c) => {
              const status = connectionStatus(String(c.status));
              const freshness = syncFreshness(c.last_success_at ? String(c.last_success_at) : null, now);
              const id = String(c.id);
              return <Panel key={id} className="org-connection">
                <div className="org-connection-head">
                  <div>
                    <h3>{String(c.name)}</h3>
                    <p className="org-muted">{String(c.provider)} · {c.resource ? String(c.resource) : c.status === "OAUTH_TENANT" ? "Choose an authorized organization" : "No organization selected"}</p>
                  </div>
                  <StatusLine label={status.label} tone={status.tone} />
                </div>
                <dl className="org-facts">
                  <div><dt>Freshness</dt><dd><StatusLine label={freshness.text} tone={freshness.tone} /></dd></div>
                  <div><dt>Coverage</dt><dd>{String(c.current_records ?? 0)} current records{c.current_coverage ? ` (${String(c.current_coverage)})` : ""}. Searchable only by the connection owner.</dd></div>
                  <div><dt>Last complete sync</dt><dd>{c.last_success_at ? new Date(String(c.last_success_at)).toLocaleString() : "Never"}</dd></div>
                  <div><dt>Recent run</dt><dd>{String(c.last_run_status ?? "None yet")}</dd></div>
                </dl>
                {c.last_error && <Alert tone="warning">{String(c.last_error)}. Correct permissions or replace the credential to restart.</Alert>}
                {c.status === "OAUTH_AUTHORIZING" && <p role="status">Authorization is waiting for consent. Complete the provider page, then return here.</p>}
                <p className="org-muted">Records appear only after a complete successful scan and are withheld after errors, disconnects, or 24 hours without success. Multi-page scans continue automatically; Refresh connections checks progress.</p>
                <div className="org-actions">
                  <Button disabled={busy || unavailableStatuses.includes(String(c.status))} onClick={() => void action(async () => { await orgApi.sync(id); })}>Pull changes</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void action(() => inspect(c))}>Inspect records & runs</Button>
                  {c.provider === "xero" && reauthStatuses.includes(String(c.status)) && <Button variant="secondary" disabled={busy || xeroBlocked} onClick={() => void action(async () => { const result = await orgApi.startXeroOAuth(id); window.location.assign(result.authorizationUrl); })}>Reconnect Xero</Button>}
                  {c.provider === "googledrive" && reauthStatuses.includes(String(c.status)) && <Button variant="secondary" disabled={busy || driveBlocked} onClick={() => void action(async () => { const result = await orgApi.startGoogleDriveOAuth(id); window.location.assign(result.authorizationUrl); })}>Reconnect Google Drive</Button>}
                  {c.provider === "googleanalytics" && reauthStatuses.includes(String(c.status)) && <Button variant="secondary" disabled={busy || analyticsBlocked} onClick={() => void action(async () => { const result = await orgApi.startGoogleAnalyticsOAuth(id); window.location.assign(result.authorizationUrl); })}>Reconnect Google Analytics</Button>}
                  <Button variant="secondary" disabled={busy || ["DISCONNECTED", "DELETED"].includes(String(c.status))} onClick={() => setDisconnecting(id)}>Disconnect</Button>
                  <Button variant="danger" disabled={busy || c.status === "DELETED"} onClick={() => setDeleting(id)}>Delete connection data</Button>
                </div>
                {disconnecting === id && <Alert tone="warning">Disconnect removes the stored credential and hides imported records. Historical rows remain in storage.
                  <div className="org-actions">
                    <Button variant="danger" disabled={busy} onClick={() => void action(async () => { await orgApi.disconnect(id); setDisconnecting(null); })}>Confirm disconnect</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => setDisconnecting(null)}>Cancel</Button>
                  </div></Alert>}
                {deleting === id && <Alert tone="danger">Permanently delete this connection and its imported records, facts, and source links? A minimal audit tombstone will remain; this cannot be undone.
                  <div className="org-actions">
                    <Button variant="danger" disabled={busy} onClick={() => void action(async () => { await orgApi.deleteConnectionData(id); setDeleting(null); })}>Permanently delete data</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button>
                  </div></Alert>}
                {c.status === "OAUTH_TENANT" && <Panel tone="raised" className="org-xero-tenant"><h4>Choose a Xero organization</h4><p className="org-muted">The authorized organizations belong to this connection owner. Selecting one starts read-only invoice synchronization.</p>
                  {!xeroTenants[id] ? <Button variant="secondary" disabled={busy} onClick={() => void action(async () => { const rows = await orgApi.xeroTenants(id); setXeroTenants((current) => ({ ...current, [id]: rows })); })}>Load authorized organizations</Button> :
                    <form className="org-form" onSubmit={(e) => { e.preventDefault(); const chosen = tenantChoice[id]; void action(async () => { await orgApi.selectXeroTenant(id, chosen); }); }}>
                      <Field label="Xero organization">{(f) => <Select {...f} required value={tenantChoice[id] ?? ""} disabled={busy} onChange={(e) => setTenantChoice((current) => ({ ...current, [id]: e.target.value }))}>
                        <option value="">Select organization</option>{xeroTenants[id].map((t) => <option key={String(t.xero_tenant_id)} value={String(t.xero_tenant_id)}>{String(t.tenant_name)}</option>)}</Select>}</Field>
                      <Button type="submit" disabled={busy || !tenantChoice[id]}>Confirm organization and sync invoices</Button>
                    </form>}
                </Panel>}
                {c.status !== "DELETED" && !oauthProviders.includes(String(c.provider)) && <details className="org-disclosure"><summary>Add or replace credential</summary><form className="org-form" onSubmit={(e) => {
                  e.preventDefault(); const form = e.currentTarget; const token = String(new FormData(form).get("token"));
                  void action(async () => { await orgApi.credential(id, token); form.reset(); });
                }}><Field label={`New credential for ${String(c.name)}`}>{(f) => <Input {...f} name="token" type="password" autoComplete="new-password" required disabled={busy || !catalog.credentialStorageReady} />}</Field>
                  <Button type="submit" disabled={busy || !catalog.credentialStorageReady}>Save credential & restart sync</Button></form></details>}
              </Panel>;
            })}
          </div>
        </Section>

        {selected && <Section title={`${String(selected.name)}, imported records`} description="Records observed by the last runs. Each record shows its provider source and observation time.">
          {!records.length && <p className="org-empty">No current records on this page. The connection may be unconfigured, synchronizing, stale, or empty.</p>}
          <ul className="org-list org-record-list">{records.map((r) => <li key={String(r.id)}><div>
            <span className="org-kind">{String(r.kind)}</span><h4>{String(r.title)}</h4>
            <p className="org-muted">{r.status ? String(r.status) : "Status not supplied"} · Observed {new Date(String(r.observed_at)).toLocaleString()}</p>
            {r.amount != null && <p>Recorded amount: {String(r.amount)} {r.currency ? String(r.currency) : "(currency not supplied)"}</p>}
            {r.department && <p>Department: {String(r.department)}. Supervisor reference: {String(r.supervisor_reference ?? "Not supplied")}.</p>}
            {r.metric && <p>{String(r.metric)}: {String(r.metric_value)} {String(r.metric_currency ?? r.unit)} · {String(r.period_start)} through {String(r.period_end)}. Campaign attribution: {String(r.campaign)}.</p>}
            {r.source_url && <a href={String(r.source_url)} target="_blank" rel="noreferrer">Open provider source</a>}
            {shareableRecordKinds.includes(String(r.kind)) && <Button variant="secondary" size="small" disabled={busy} onClick={() => void action(() => startMapping(r))}>Share record with project work</Button>}
          </div></li>)}</ul>
          <div className="org-actions"><Button variant="secondary" disabled={busy || !offset} onClick={() => void action(() => inspect(selected, offset - 100))}>Previous records</Button>
            <Button variant="secondary" disabled={busy || records.length < 100} onClick={() => void action(() => inspect(selected, offset + 100))}>Next records</Button></div>
          <DataTable title="Recent synchronization runs" rows={runs} columns={[["status", "Status"], ["records_seen", "Records observed"], ["started_at", "Started"], ["finished_at", "Finished"], ["error_code", "Error"]]} />
        </Section>}

        {mapping && <Section title="Share a provider record with project work" description="Confirming shares this source snapshot with everyone who can read the selected project.">
          <Panel>
            <p><span className="org-kind">{String(mapping.kind)}</span> {String(mapping.title)}</p>
            {mapping.amount != null && <p>Financial snapshot: {String(mapping.amount)} {mapping.currency ? String(mapping.currency) : "currency not supplied"}. The amount keeps its source currency; it is not converted or combined with other currencies.</p>}
            {mapping.department && <p>Employee snapshot: {String(mapping.department)} department · supervisor {String(mapping.supervisor_reference ?? "not supplied")}.</p>}
            {mapping.metric && <p>Marketing snapshot: {String(mapping.metric)} {String(mapping.metric_value)} {String(mapping.metric_currency ?? mapping.unit)} · {String(mapping.period_start)} through {String(mapping.period_end)} · campaign {String(mapping.campaign)}.</p>}
            <p className="org-muted">Confirming shares this source snapshot with everyone who can read the selected project, including future project members. New tasks start as unassigned TODO work with no guessed effort or deadline. Linking does not edit existing tasks.</p>
            <form className="org-form" onSubmit={(e) => {
              e.preventDefault(); const body = Object.fromEntries(new FormData(e.currentTarget).entries());
              void action(async () => { await orgApi.mapSource(projectId, { recordId: mapping.id, taskId: body.taskId || null, rationale: body.rationale, shareWithProject: body.share === "on" }); setMapping(null); });
            }}>
              <Field label="Target project">{(f) => <Select {...f} required value={projectId} disabled={busy} onChange={(e) => {
                const id = e.target.value; setProjectId(id); setTasks([]);
                if (id) void action(async () => { const d = await workApi.detail(id); if (!d.project.can_write) { setProjectId(""); throw new Error("Write access is required for the target project."); } setTasks(d.tasks); });
              }}><option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</Field>
              <div className="org-actions"><Button variant="secondary" disabled={busy || projectPage === 0} onClick={() => void action(() => startMapping(mapping, projectPage - 100))}>Previous projects</Button><Button variant="secondary" disabled={busy || projects.length < 100} onClick={() => void action(() => startMapping(mapping, projectPage + 100))}>Next projects</Button></div>
              <Field label="Target task" hint="Lists the first 100 tasks in this project.">{(f) => <Select {...f} name="taskId" disabled={busy || !projectId}><option value="">Create a new task from this source</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select>}</Field>
              <Field label="Why these records represent the same work">{(f) => <Input {...f} name="rationale" required maxLength={1000} disabled={busy} />}</Field>
              <label className="org-check"><input type="checkbox" name="share" required disabled={busy} />I am authorized to share this record with the project audience.</label>
              <div className="org-actions"><Button type="submit" disabled={busy || !projectId}>Confirm sharing and link</Button><Button variant="secondary" disabled={busy} onClick={() => setMapping(null)}>Cancel</Button></div>
            </form>
          </Panel>
        </Section>}
      </>}
    </div>
  );
}
