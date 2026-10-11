"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, getToken, SESSION_EXPIRED_EVENT } from "@/lib/api";
import { Alert, Badge, Button, Card } from "@/components/ui";
import "./admin.css";

export default function AdminPage() {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof api.adminMetrics>
  > | null>(null);
  const [metrics, setMetrics] = useState<Awaited<
    ReturnType<typeof api.metrics>
  > | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [metricsError, setMetricsError] = useState(false);
  const [running, setRunning] = useState<"retrieval" | "rag" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setErr(null);
    setDenied(false);
    setData(null);
    setMetrics(null);
    setMetricsError(false);
    if (!getToken()) {
      setDenied(true);
      setErr("Sign in with an administrator account to view workspace health.");
      return;
    }
    try {
      // Confirm admin access before loading secondary service metrics.
      setData(await api.adminMetrics());
      try {
        setMetrics(await api.metrics());
      } catch {
        setMetricsError(true);
      }
    } catch (error) {
      const accessDenied =
        error instanceof ApiError && [401, 403].includes(error.status);
      setDenied(accessDenied);
      setErr(
        accessDenied
          ? error.status === 403
            ? "This overview is available to workspace administrators."
            : "Your session has expired. Sign in again to continue."
          : "Workspace health could not be loaded. Check your connection and try again.",
      );
    }
  }, []);

  useEffect(() => {
    const expire = () => {
      setData(null);
      setMetrics(null);
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
        setResult(
          `Retrieval hit rate: ${(r.hitRate * 100).toFixed(1)}% (${r.hits}/${r.total}).`,
        );
      } else {
        const r = await api.evalRag();
        setResult(
          `Answer accuracy: ${(r.accuracy * 100).toFixed(1)}% (${r.ok}/${r.total}).`,
        );
      }
    } catch (e) {
      setEvalError(
        e instanceof Error ? e.message : "Evaluation failed. Try again.",
      );
    } finally {
      setRunning(null);
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link href="/app">← Back to the desk</Link>
        <div className="admin-header-actions">
          {data && (
            <Button
              variant="secondary"
              size="small"
              disabled={running !== null}
              onClick={() => void refresh()}
            >
              Refresh overview
            </Button>
          )}
          <Badge>Administrator</Badge>
        </div>
      </header>
      <div className="admin-intro">
        <p className="brand-mark">Kiro / Workspace health</p>
        <h1>A clear view of the desk.</h1>
        <p className="muted">
          Query activity, service performance, and answer quality.
        </p>
      </div>
      {err ? (
        <Card className="admin-access-state">
          <p className="brand-mark">
            {denied ? "Workspace access" : "Connection interrupted"}
          </p>
          <h2>
            {denied
              ? "The right access opens this view."
              : "Let’s reconnect to your desk."}
          </h2>
          <Alert tone={denied ? "info" : "danger"}>{err}</Alert>
          <div className="actions">
            {denied ? (
              <Link className="btn signal" href="/app">
                Return to the desk
              </Link>
            ) : (
              <Button variant="primary" onClick={() => void refresh()}>
                Try again
              </Button>
            )}
          </div>
        </Card>
      ) : !data ? (
        <Alert>Loading admin metrics…</Alert>
      ) : (
        <>
          <div className="admin-stats">
            <Card>
              <p className="section-label">Total queries</p>
              <strong>{data.queries.toLocaleString()}</strong>
            </Card>
            <Card>
              <p className="section-label">Helpful answers</p>
              <strong>
                {(
                  data.feedback.find((f) => f.helpful)?._count ?? 0
                ).toLocaleString()}
              </strong>
            </Card>
            <Card>
              <p className="section-label">Recent failures</p>
              <strong>{data.recentErrors.length.toLocaleString()}</strong>
            </Card>
          </div>
          {data.recentErrors.length === 0 && (
            <div className="admin-health-note" role="status">
              <Badge tone="success">No recent failures</Badge>
              <p>
                No failures were recorded in the recent activity returned by
                your workspace.
              </p>
            </div>
          )}
          {metricsError && (
            <Alert tone="warning">
              Service performance is temporarily unavailable. Refresh the
              overview to try again.
            </Alert>
          )}
          {data.recentErrors.length > 0 && (
            <Card className="admin-section">
              <h2>Recent failures</h2>
              <details>
                <summary>Inspect recorded failures</summary>
                <pre className="admin-errors">
                  {JSON.stringify(data.recentErrors, null, 2)}
                </pre>
              </details>
            </Card>
          )}
          {metrics && (
            <Card className="admin-section">
              <h2>Service performance</h2>
              <div className="admin-table-wrap">
                <table>
                  <caption className="sr-only">
                    Service latency and error counts
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Operation</th>
                      <th scope="col">Requests</th>
                      <th scope="col">Average latency</th>
                      <th scope="col">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(metrics.latencies).map(([name, value]) => (
                      <tr key={name}>
                        <th scope="row">{name}</th>
                        <td>{value.count.toLocaleString()}</td>
                        <td>{value.avgMs.toFixed(0)} ms</td>
                        <td>{value.errors.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {Object.keys(metrics.latencies).length === 0 && (
                <p className="muted">
                  Performance data appears after the first request.
                </p>
              )}
              <details>
                <summary>Service counters</summary>
                <pre>{JSON.stringify(metrics.counters, null, 2)}</pre>
              </details>
            </Card>
          )}
          <Card className="admin-section">
            <h2>Answer quality</h2>
            <p className="muted">
              Check retrieval and answers against the reference dataset.
            </p>
            <div className="actions">
              <Button
                variant="primary"
                disabled={running !== null}
                onClick={() => void evaluate("retrieval")}
              >
                {running === "retrieval"
                  ? "Evaluating…"
                  : "Run retrieval evaluation"}
              </Button>
              <Button
                variant="secondary"
                disabled={running !== null}
                onClick={() => void evaluate("rag")}
              >
                {running === "rag" ? "Evaluating…" : "Run answer evaluation"}
              </Button>
            </div>
            {result && <Alert tone="success">{result}</Alert>}
            {evalError && <Alert tone="danger">{evalError}</Alert>}
          </Card>
        </>
      )}
    </main>
  );
}
