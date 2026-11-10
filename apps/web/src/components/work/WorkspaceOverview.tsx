"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Section } from "@/components/ui";
import { HBarChart, StackedBar, StatTile, formatNumber } from "@/components/charts";
import { homeApi, type ThroughputResponse } from "@/lib/home-api";
import type { WorkInsight, WorkNotification, WorkOverview, WorkProject } from "@/lib/work-api";
import { projectCompletion, taskStatusSegments } from "@/lib/work-metrics";
import { HomeThroughput } from "../HomeInsights";
import { INSIGHT_LABELS, INSIGHT_RECOMMENDATIONS } from "./insight-copy";

type Props = {
  overview: WorkOverview;
  projects: WorkProject[];
  notifications: WorkNotification[];
  insights: WorkInsight[];
  insightOffset: number;
  busy: boolean;
  onReview: (n: WorkNotification) => void;
  onMarkRead: (n: WorkNotification) => void;
  onInspect: (i: WorkInsight) => void;
  onInsightPage: (delta: number) => void;
};

// Workspace-wide view shown when no project is selected: totals, notifications, and the insight center.
export function WorkspaceOverview({ overview, projects, notifications, insights, insightOffset, busy, onReview, onMarkRead, onInspect, onInsightPage }: Props) {
  const m = overview.metrics;
  const [throughput, setThroughput] = useState<ThroughputResponse | null>(null);
  const [throughputError, setThroughputError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    homeApi.throughput(8).then(
      (t) => { if (active) setThroughput(t); },
      (e: unknown) => { if (active) setThroughputError(e instanceof Error ? e.message : "Weekly completions could not be loaded."); },
    );
    return () => { active = false; };
  }, []);
  return (
    <div className="work-overview">
      <Section title="Workspace totals" description={`${overview.scope}. ${overview.method}`}>
        <div className="work-stat-grid">
          <StatTile label="Recorded tasks" value={formatNumber(m.total_tasks)} />
          <StatTile label="Completed" value={formatNumber(m.completed_tasks)} />
          <StatTile label="Overdue" value={formatNumber(m.overdue_tasks)} note="Unfinished and due before today" />
          <StatTile label="Blocked" value={formatNumber(m.blocked_tasks)} />
          <StatTile label="Unassigned" value={formatNumber(m.unassigned_tasks)} />
          <StatTile label="Estimated hours remaining" value={formatNumber(m.estimated_remaining_hours)} note={`${m.missing_estimates} unfinished tasks lack estimates`} />
        </div>
        <div className="work-charts">
          <StackedBar title="Task status" description="Every recorded task in your scope. Open excludes blocked." segments={taskStatusSegments(m)} emptyText="No tasks recorded yet." />
          <HomeThroughput throughput={throughput} error={throughputError} />
          <HBarChart
            title="Projects by completion"
            description="Share of each project's tasks that are done, on this page of projects."
            items={projectCompletion(projects)}
            valueFormat={(v) => `${v}%`}
            emptyText="No projects with tasks yet."
          />
        </div>
        <details className="work-disclosure">
          <summary>Calculation and data quality</summary>
          <p>{overview.method}</p>
          <p>{m.missing_estimates} unfinished tasks lack effort estimates. Hours are estimates, not actual effort.</p>
          <p>{overview.utilizationUnavailable}</p>
          <p>{overview.freshness}. Reporting period: {overview.period}.</p>
          <p>Last task update: {m.last_record_updated_at ? new Date(m.last_record_updated_at).toLocaleString() : "No tasks recorded"}. This view is a snapshot; refresh after access or work changes.</p>
        </details>
      </Section>
      <Section title="Notifications" description="In-app updates for scenario approval requests and decisions, limited to projects you can still access.">
        {!notifications.length ? <p>No notifications.</p> : (
          <ul className="work-plain-list">
            {notifications.map((n) => (
              <li key={n.id}>
                <Badge tone={n.read_at ? "neutral" : "info"}>{n.read_at ? "Read" : "New"}</Badge>
                <p>{n.kind === "SCENARIO_APPROVAL_REQUESTED" ? "A scenario needs review" : "A scenario approval was decided"} · {n.project_name} · {new Date(n.created_at).toLocaleString()}</p>
                <div className="work-actions">
                  <Button variant="secondary" size="small" disabled={busy} onClick={() => onReview(n)}>Review scenario</Button>
                  {!n.read_at && <Button variant="secondary" size="small" disabled={busy} onClick={() => onMarkRead(n)}>Mark read</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Insight center" description="Rule-based observations from recorded tasks. Suggestions require human judgment.">
        {!insights.length && insightOffset === 0 && <p>No detected risks on this page. This does not establish that all work is on track.</p>}
        <ul className="work-plain-list">
          {insights.map((i) => (
            <li key={i.id}>
              <Badge tone={i.resolved_at ? "success" : "warning"}>{i.resolved_at ? "Resolved" : INSIGHT_LABELS[i.rule]}</Badge>
              {!i.resolved_at && i.triage_status !== "OPEN" && <Badge>{i.triage_status === "ACKNOWLEDGED" ? "Acknowledged" : "Dismissed"}</Badge>}
              <h3>{i.title}</h3>
              <p>{INSIGHT_RECOMMENDATIONS[i.rule]}</p>
              <Button variant="secondary" size="small" disabled={busy} onClick={() => onInspect(i)}>Inspect evidence</Button>
            </li>
          ))}
        </ul>
        <div className="work-actions">
          <Button variant="secondary" size="small" disabled={busy || !insightOffset} onClick={() => onInsightPage(-100)}>Previous insights</Button>
          <Button variant="secondary" size="small" disabled={busy || insights.length < 100} onClick={() => onInsightPage(100)}>Next insights</Button>
        </div>
      </Section>
      {!notifications.length && !insights.length && !m.total_tasks && <Alert tone="info">No recorded work yet. Create a project to start.</Alert>}
    </div>
  );
}
