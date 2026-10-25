"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { request } from "@/lib/api";
import { orgApi, type DataRow } from "@/lib/organization-api";
import { type WorkDetail } from "@/lib/work-api";
export default function ProjectActions({ detail }: { detail: WorkDetail }) {
  const [rows, setRows] = useState<DataRow[]>([]), [connections, setConnections] = useState<DataRow[]>([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0), [offset, setOffset] = useState(0), [confirm, setConfirm] = useState<string | null>(null);
  const base = `/work/projects/${encodeURIComponent(detail.project.id)}/actions`;
  useEffect(() => { let active = true; setLoading(true); setError(""); setRows([]);
    Promise.all([request<DataRow[]>(`${base}?offset=${offset}`), orgApi.catalog().then(c => c.canManage ? orgApi.connections() : [])]).then(([r, c]) => {
      if (active) { setRows(r); setConnections(c.filter(x => x.provider === "github")); }
    }).catch(e => { if (active) setError((e as Error).message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base, offset, revision]);
  async function action(fn: () => Promise<unknown>) { setBusy(true); setError(""); try { await fn(); setConfirm(null); setRevision(n => n + 1); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <section className="org-stack" aria-busy={busy || loading}><h3>Approved provider actions</h3>
    <p>Propose a GitHub issue, obtain review from a different project editor, then explicitly execute it. Your GitHub token needs Issues write access.</p>
    {error && <Alert tone="danger">{error}</Alert>}{loading && <p role="status">Loading actions…</p>}
    {detail.project.can_write && connections.length > 0 && <form className="org-form" onSubmit={e => {
      e.preventDefault(); const form = e.currentTarget; const values = Object.fromEntries(new FormData(form).entries());
      void action(async () => { await request(base, { method: "POST", body: { ...values, confirmExternalSharing: values.confirmExternalSharing === "on" } }); form.reset(); });
    }}>
      <Field label="GitHub repository">{f => <Select {...f} name="connectionId" required disabled={busy} defaultValue=""><option value="">Select your connection</option>{connections.map(c => <option key={String(c.id)} value={String(c.id)}>{String(c.resource)} — {String(c.status)}</option>)}</Select>}</Field>
      <Field label="Exact issue title">{f => <Input {...f} name="title" required maxLength={200} disabled={busy} />}</Field>
      <Field label="Exact issue body">{f => <Textarea {...f} name="body" required maxLength={10000} disabled={busy} />}</Field>
      <Field label="Evidence, expected benefit and risks">{f => <Textarea {...f} name="rationale" required maxLength={1000} disabled={busy} />}</Field>
      <label className="org-check"><input type="checkbox" required name="confirmExternalSharing" disabled={busy} />I am authorized to publish this content to the selected repository.</label>
      <Button type="submit" disabled={busy}>Submit for independent review</Button>
    </form>}
    {!loading && !rows.length && <p>No proposed actions on this page.</p>}
    {rows.map(a => <article key={String(a.id)}><h4>{String(a.title)}</h4><Badge>{String(a.status)}</Badge>
      <p>Repository: {String(a.repository)}</p><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{String(a.body)}</pre><p>{String(a.rationale)}</p>
      {a.decision_reason && <p>Reviewer: {String(a.decision_reason)}</p>}{a.error_code && <Alert tone="warning">{String(a.error_code)}</Alert>}
      {a.external_url && <a href={String(a.external_url)} target="_blank" rel="noreferrer">Open created issue</a>}
      {["UNKNOWN", "EXECUTING"].includes(String(a.status)) && <Alert tone="warning">This request may have reached GitHub. Check the repository for <code>kiro-action:{String(a.id)}</code> before proposing another action. This request will not be retried automatically.</Alert>}
      {a.status === "PROPOSED" && detail.project.can_write && a.requested_by !== detail.viewer_id && <form className="org-form" onSubmit={e => {
        e.preventDefault(); const b = new FormData(e.currentTarget); void action(() => request(`${base}/${a.id}/decision`, { method: "POST", body: { expectedVersion: a.version, approve: b.get("decision") === "approve", reason: b.get("reason") } }));
      }}><Field label={`Review decision for ${a.title}`}>{f => <Select {...f} name="decision" disabled={busy}><option value="reject">Reject</option><option value="approve">Approve exact content</option></Select>}</Field>
        <Field label="Review rationale">{f => <Input {...f} name="reason" required maxLength={1000} disabled={busy} />}</Field><Button type="submit" disabled={busy}>Record decision</Button></form>}
      {a.status === "APPROVED" && detail.project.can_write && a.requested_by === detail.viewer_id && <>
        {confirm !== a.id ? <Button disabled={busy} onClick={() => setConfirm(String(a.id))}>Review execution</Button> : <Alert tone="warning">Create this issue in {String(a.repository)} now? This sends the approved content to GitHub.
          <div className="org-tabs"><Button disabled={busy} onClick={() => void action(() => request(`${base}/${a.id}/execute`, { method: "POST", body: { expectedVersion: a.version, confirmExecution: true } }))}>Confirm and create issue</Button><Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button></div></Alert>}
      </>}
    </article>)}
    <div className="org-tabs"><Button variant="secondary" disabled={busy || loading || !offset} onClick={() => setOffset(n => n - 100)}>Previous actions</Button><Button variant="secondary" disabled={busy || loading || rows.length < 100} onClick={() => setOffset(n => n + 100)}>Next actions</Button><Button variant="secondary" disabled={busy || loading} onClick={() => setRevision(n => n + 1)}>Refresh actions</Button></div>
  </section>;
}
