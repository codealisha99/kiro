"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, getToken, SESSION_EXPIRED_EVENT } from "@/lib/api";
import type { AuditEvent } from "@/lib/admin-view";
import { orgApi } from "@/lib/organization-api";
import { Alert, Badge, Button, Card, PageHeader, Section } from "@/components/ui";
import { AdminActivity, AdminAuditLog, AdminProcessing, AdminUsage, type Ingestion } from "@/components/admin/AdminInsights";
import "./admin.css";

type AdminMetrics = Awaited<ReturnType<typeof api.adminMetrics>>;
type ServiceMetrics = Awaited<ReturnType<typeof api.metrics>>;
// Secondary panels load independently: one failing never hides the others.
type Part<T> = { value: T | null; failed: boolean };
const empty = <T,>(): Part<T> => ({ value: null, failed: false });

export default function AdminPage() {
  const [data, setData] = useState<AdminMetrics | null>(null);
  const [service, setService] = useState<Part<ServiceMetrics>>(empty);
  const [audit, setAudit] = useState<Part<AuditEvent[]>>(empty);
  const [ingestion, setIngestion] = useState<Part<Ingestion>>(empty);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [err, setErr] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [running, setRunning] = useState<"retrieval" | "rag" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setErr(null);
    setDenied(false);
    setData(null);
    if (!getToken()) {
      setDenied(true);
      setErr("Sign in with an administrator account to view workspace health.");
      return;
    }
    try {
      // Confirm admin access before loading anything else.
      setData(await api.adminMetrics());
    } catch (error) {
      const accessDenied = error instanceof ApiError && [401, 403].includes(error.status);
      setDenied(accessDenied);
      setErr(
        accessDenied
          ? error.status === 403
            ? "This overview is available to workspace administrators."
            : "Your session has expired. Sign in again to continue."
          : "Workspace health could not be loaded. Check your connection and try again.",
      );
      return;
    }
    setLoadedAt(Date.now());
    const [s, a, i, o] = await Promise.allSettled([api.metrics(), api.adminAudit(200), api.adminIngestion(), orgApi.setup()]);
    setService(s.status === "fulfilled" ? { value: s.value, failed: false } : { value: null, failed: true });
    setAudit(a.status === "fulfilled" ? { value: a.value, failed: false } : { value: null, failed: true });
    setIngestion(i.status === "fulfilled" ? { value: i.value, failed: false } : { value: null, failed: true });
    if (o.status === "fulfilled") {
      setNames(Object.fromEntries((o.value.users ?? []).map((u) => [String(u.id), String(u.name ?? u.email ?? "Unnamed")])));
    }
  }, []);

  useEffect(() => {
    const expire = () => {
      setData(null);
      setDenied(true);
      setErr("Your session has expired. Sign in again to continue.");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    void refresh();
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, [refresh]);

  async function evaluate(kind: "retrieval" | "rag") {
    setRunning(kind);
    setResult(null);
    setEvalError(null);
    try {
      if (kind === "retrieval") {
        const r = await api.evalRetrieval();
        setResult(`Retrieval hit rate: ${(r.hitRate * 100).toFixed(1)}% (${r.hits}/${r.total}).`);
      } else {
        const r = await api.evalRag();
        setResult(`Answer accuracy: ${(r.accuracy * 100).toFixed(1)}% (${r.ok}/${r.total}).`);
      }
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : "Evaluation failed. Try again.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link href="/app">← Back to the desk</Link>
        <Badge>Administrator</Badge>
      </header>
      <PageHeader
        eyebrow="Administration"
        title="Workspace health"
        subtitle="How your company uses Kiro, how ready its knowledge is, and a record of every question."
        actions={data ? <Button variant="secondary" size="small" disabled={running !== null} onClick={() => void refresh()}>Refresh</Button> : undefined}
      />
      {err ? (
        <Card className="admin-access-state">
          <p className="brand-mark">{denied ? "Workspace access" : "Connection interrupted"}</p>
          <h2>{denied ? "The right access opens this view." : "Let’s reconnect to your desk."}</h2>
          <Alert tone={denied ? "info" : "danger"}>{err}</Alert>
          <div className="actions">
            {denied ? (
              <Link className="btn signal" href="/app">Return to the desk</Link>
            ) : (
              <Button variant="primary" onClick={() => void refresh()}>Try again</Button>
            )}
          </div>
        </Card>
      ) : !data ? (
        <p role="status">Loading workspace health…</p>
      ) : (
        <div className="admin-sections">
          <Section title="Usage">
            <AdminUsage queries={data.queries} feedback={data.feedback} ingestion={ingestion.value} />
          </Section>

          <Section title="Activity" description="Questions answered and failed, and how people rated the answers.">
            {audit.failed ? (
              <Alert tone="warning">Recent activity could not be loaded. Refresh to try again.</Alert>
            ) : audit.value ? (
              <AdminActivity events={audit.value} feedback={data.feedback} nowMs={loadedAt} />
            ) : (
              <p role="status">Loading activity…</p>
            )}
          </Section>

          <Section title="Document processing" description="Whether added knowledge is ready to answer from.">
            {ingestion.failed ? (
              <Alert tone="warning">Processing status could not be loaded. Refresh to try again.</Alert>
            ) : ingestion.value ? (
              <AdminProcessing ingestion={ingestion.value} />
            ) : (
              <p role="status">Loading processing status…</p>
            )}
          </Section>

          <Section title="Audit log" description="The 50 most recent events, newest first. Questions are shown as asked.">
            {audit.failed ? (
              <Alert tone="warning">The audit log could not be loaded. Refresh to try again.</Alert>
            ) : audit.value ? (
              <AdminAuditLog events={audit.value} names={names} />
            ) : (
              <p role="status">Loading the audit log…</p>
            )}
          </Section>

          <Section title="Service performance" description="Requests, average latency and errors since the API last started.">
            {service.failed ? (
              <Alert tone="warning">Service performance is temporarily unavailable. Refresh to try again.</Alert>
            ) : !service.value ? (
              <p role="status">Loading service performance…</p>
            ) : Object.keys(service.value.latencies).length === 0 ? (
              <p className="admin-muted">Performance data appears after the first request.</p>
            ) : (
              <div className="admin-table-wrap" role="region" aria-label="Service performance, scrollable" tabIndex={0}>
                <table>
                  <caption className="sr-only">Service latency and error counts</caption>
                  <thead>
                    <tr>
                      <th scope="col">Operation</th>
                      <th scope="col">Requests</th>
                      <th scope="col">Average latency</th>
                      <th scope="col">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(service.value.latencies).map(([name, value]) => (
                      <tr key={name}>
                        <th scope="row">{name}</th>
                        <td>{value.count.toLocaleString("en-US")}</td>
                        <td>{value.avgMs.toFixed(0)} ms</td>
                        <td>{value.errors.toLocaleString("en-US")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Answer quality" description="Check retrieval and answers against the reference dataset.">
            <div className="actions">
              <Button variant="primary" disabled={running !== null} onClick={() => void evaluate("retrieval")}>
                {running === "retrieval" ? "Evaluating…" : "Run retrieval evaluation"}
              </Button>
              <Button variant="secondary" disabled={running !== null} onClick={() => void evaluate("rag")}>
                {running === "rag" ? "Evaluating…" : "Run answer evaluation"}
              </Button>
            </div>
            {result && <Alert tone="success">{result}</Alert>}
            {evalError && <Alert tone="danger">{evalError}</Alert>}
          </Section>
        </div>
      )}
    </main>
  );
}
