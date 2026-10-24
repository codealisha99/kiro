"use client";
import { useEffect, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { orgApi, type DataRow } from "@/lib/organization-api";
export default function ProjectSources({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const [rows, setRows] = useState<DataRow[]>([]), [error, setError] = useState("");
  const [offset, setOffset] = useState(0), [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; setLoading(true); setRows([]); setError("");
    orgApi.projectSources(projectId, offset).then(r => { if (active) setRows(r); }).catch(e => { if (active) setError((e as Error).message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, offset, revision]);
  return <section aria-busy={loading || busy}><h3>Linked provider evidence</h3>
    <p>Explicitly shared source snapshots. Source changes never silently overwrite project tasks. Unlinking retains the task and audit history.</p>
    {error && <Alert tone="danger">{error}</Alert>}{loading && <p role="status">Loading sources…</p>}
    {!loading && !rows.length && <p>No shared sources on this page.</p>}
    <ul>{rows.map(r => <li key={String(r.id)}><strong>{String(r.source_title)}</strong> — {String(r.freshness)}
      <p>{String(r.rationale)} · Snapshot {new Date(String(r.source_observed_at)).toLocaleString()}</p>
      {r.source_url && <a href={String(r.source_url)} target="_blank" rel="noreferrer">Open original source</a>}
      {canWrite && <Button variant="secondary" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await orgApi.revokeSource(projectId, String(r.id)); setRevision(n => n + 1); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Unlink source</Button>}
    </li>)}</ul>
    <Button variant="secondary" disabled={loading || busy || !offset} onClick={() => setOffset(n => n - 100)}>Previous sources</Button>
    <Button variant="secondary" disabled={loading || busy || rows.length < 100} onClick={() => setOffset(n => n + 100)}>Next sources</Button>
  </section>;
}
