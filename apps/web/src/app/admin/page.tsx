"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getToken } from "@/lib/api";
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
  const [running, setRunning] = useState<"retrieval" | "rag" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setErr("Sign in as an admin to view metrics.");
      return;
    }
    api
      .adminMetrics()
      .then(setData)
      .catch((e) => setErr(String(e)));
    api
      .metrics()
      .then(setMetrics)
      .catch(() => undefined);
  }, []);

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
        <Link href="/">← Back to the desk</Link>
        <Badge>Admin</Badge>
      </header>
      <div className="admin-intro">
        <p className="brand-mark">Kiro / Workspace health</p>
        <h1>A clear view of the desk.</h1>
        <p className="muted">
          Query activity, service performance, and answer quality.
        </p>
      </div>
      {err ? (
        <Alert tone="danger">
          {err} <Link href="/">Go to sign in</Link>
        </Alert>
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
          {data.recentErrors.length > 0 && (
            <Card className="admin-section">
              <h2>Recent failures</h2>
              <pre className="admin-errors">
                {JSON.stringify(data.recentErrors, null, 2)}
              </pre>
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
