"use client";

import { useEffect, useState } from "react";
import { api, getToken } from "@/lib/api";

export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setErr("Sign in as an admin to view metrics");
      return;
    }
    api.adminMetrics().then(setData).catch((e) => setErr(String(e)));
    api.metrics().then(setMetrics).catch(() => undefined);
  }, []);

  if (err) return <div style={{ padding: 24 }}><h2>Admin</h2><p style={{ color: "crimson" }}>{err}</p></div>;
  if (!data) return <div style={{ padding: 24 }}>Loading admin metrics…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", fontFamily: "Outfit, sans-serif" }}>
      <h2>Admin — Kiro</h2>
      <p style={{ color: "#666" }}>Sources · Knowledge · Security · AI (per build-plan:10-stack.md)</p>

      <section style={{ marginTop: 24, border: "1px solid #e5e5e5", padding: 16, borderRadius: 8 }}>
        <h3>Queries</h3>
        <p>Total requests: <strong>{data.queries}</strong></p>
        <pre style={{ background: "#fafafa", padding: 12, overflow: "auto" }}>{JSON.stringify(data.feedback, null, 2)}</pre>
        {data.recentErrors?.length ? (
          <>
            <h4>Recent failures</h4>
            <pre style={{ background: "#fef2f2", padding: 12, overflow: "auto" }}>{JSON.stringify(data.recentErrors, null, 2)}</pre>
          </>
        ) : null}
      </section>

      {metrics && (
        <section style={{ marginTop: 16, border: "1px solid #e5e5e5", padding: 16, borderRadius: 8 }}>
          <h3>Latency</h3>
          <pre style={{ background: "#fafafa", padding: 12, overflow: "auto" }}>{JSON.stringify(metrics.latencies, null, 2)}</pre>
          <pre style={{ background: "#fafafa", padding: 12, overflow: "auto" }}>{JSON.stringify(metrics.counters, null, 2)}</pre>
        </section>
      )}

      <section style={{ marginTop: 16, border: "1px solid #e5e5e5", padding: 16, borderRadius: 8 }}>
        <h3>Evaluation</h3>
        <p>Run golden dataset:</p>
        <button
          className="btn"
          onClick={async () => {
            const r = await api.evalRetrieval();
            alert(`Retrieval hitRate=${r.hitRate} (${r.hits}/${r.total})`);
          }}
        >
          Run retrieval eval
        </button>{" "}
        <button
          className="btn"
          onClick={async () => {
            const r = await api.evalRag();
            alert(`RAG accuracy=${r.accuracy} (${r.ok}/${r.total})`);
          }}
        >
          Run RAG eval
        </button>
      </section>
    </div>
  );
}
