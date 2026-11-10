"use client";

import { BarChart, StackedBar, StatTile, formatDayLong, formatDayShort, formatNumber, formatPercent } from "@/components/charts";
import { Badge } from "@/components/ui";
import { actionLabel, decisionLabel, feedbackSegments, questionsPerDay, searchReadiness, type AuditEvent } from "@/lib/admin-view";

export type Ingestion = { sources: number; documents: number; chunks: number; embeddedChunks: number; failed: { versionId: string; error: string }[] };
type Feedback = { helpful: boolean; _count: number }[];

const DAYS = 14;

export function AdminUsage({ queries, feedback, ingestion }: { queries: number; feedback: Feedback; ingestion: Ingestion | null }) {
  const [helpful, notHelpful] = feedbackSegments(feedback).map((s) => s.value);
  const rated = helpful + notHelpful;
  const readiness = ingestion ? searchReadiness(ingestion.chunks, ingestion.embeddedChunks) : null;
  return (
    <div className="admin-tiles">
      <StatTile label="Questions asked" value={formatNumber(queries)} note="All time, in this workspace." />
      <StatTile label="Rated helpful" value={rated ? formatPercent(helpful / rated) : "No ratings"} note={rated ? `${helpful} of ${rated} rated answers.` : "People rate answers from the answer view."} />
      <StatTile label="Documents" value={ingestion ? formatNumber(ingestion.documents) : "…"} note={ingestion ? `From ${ingestion.sources} ${ingestion.sources === 1 ? "source" : "sources"}.` : undefined} />
      <StatTile label="Ready for semantic search" value={readiness === null ? "Nothing indexed" : formatPercent(readiness)} note="Share of indexed text with embeddings." />
    </div>
  );
}

export function AdminActivity({ events, feedback, nowMs }: { events: AuditEvent[]; feedback: Feedback; nowMs: number }) {
  const daily = questionsPerDay(events, DAYS, nowMs);
  return (
    <div className="admin-charts">
      <BarChart
        title={`Questions per day, last ${DAYS} days`}
        description={`From the ${events.length} most recent audit events. Answered and failed, by UTC day.`}
        categories={daily.dayStarts.map(formatDayShort)}
        series={[
          { id: "answered", label: "Answered", values: daily.answered },
          { id: "failed", label: "Failed", values: daily.failed },
        ]}
        stacked
        height={200}
        emptyText="No questions in the last two weeks."
      />
      <StackedBar title="Answer feedback" description="Every rating people have given, all time." segments={feedbackSegments(feedback)} emptyText="No answers rated yet." />
    </div>
  );
}

export function AdminProcessing({ ingestion }: { ingestion: Ingestion }) {
  const pending = Math.max(0, ingestion.chunks - ingestion.embeddedChunks);
  return (
    <div className="admin-charts">
      <StackedBar
        title="Search preparation"
        description="Indexed text passages and whether they are ready for semantic search. Keyword search works either way."
        segments={[
          { id: "ready", label: "Ready", value: ingestion.embeddedChunks, tone: "good" },
          { id: "pending", label: "Waiting for embeddings", value: pending, tone: "warning" },
        ]}
        emptyText="No documents indexed yet."
      />
      <div className="admin-failures">
        <h3>Failed processing jobs</h3>
        {ingestion.failed.length === 0 ? (
          <p className="admin-muted"><Badge tone="success">None</Badge> No document in this workspace failed processing recently.</p>
        ) : (
          <ul>
            {ingestion.failed.map((f) => (
              <li key={f.versionId}>
                <code>{f.versionId}</code>
                <span>{f.error || "No error detail recorded."}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const OUTCOME_TONE: Record<string, "success" | "danger" | "neutral"> = { "query.completed": "success", "query.failed": "danger" };

export function AdminAuditLog({ events, names }: { events: AuditEvent[]; names: Record<string, string> }) {
  const shown = events.slice(0, 50);
  if (!shown.length) return <p className="admin-muted">No activity recorded yet. Questions appear here as people ask them.</p>;
  return (
    <div className="admin-table-wrap" role="region" aria-label="Audit log, scrollable" tabIndex={0}>
      <table>
        <caption className="sr-only">Most recent audit events, newest first</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Person</th>
            <th scope="col">Event</th>
            <th scope="col">Access</th>
            <th scope="col">Question or detail</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((e) => (
            <tr key={e.id}>
              <td className="admin-nowrap">{formatDayLong(Date.parse(e.createdAt))} {new Date(e.createdAt).toISOString().slice(11, 16)} UTC</td>
              <td>{e.userId ? names[e.userId] ?? "Unknown person" : "System"}</td>
              <td><Badge tone={OUTCOME_TONE[e.action] ?? "neutral"}>{actionLabel(e.action)}</Badge></td>
              <td>{decisionLabel(e.permissionDecision)}</td>
              <td className="admin-detail">{e.error ? `${e.query ?? ""} — ${e.error}` : e.query ?? e.resource ?? "Not recorded"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
