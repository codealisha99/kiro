"use client";
import { Alert, Badge, Button, Section } from "@/components/ui";
import { BarChart, HBarChart, LineChart, StackedBar, StatTile, formatDayShort, formatNumber, formatPercent } from "@/components/charts";
import type { WorkDetail, WorkInsight } from "@/lib/work-api";
import { STATUS_LABELS, completionsByWeek, openByAssignee, openTasksOverTime, STATUS_ORDER, summarizeTasks, todayIso } from "@/lib/work-metrics";
import { INSIGHT_LABELS } from "./insight-copy";
import { memberName } from "./TaskList";
import type { ChartTone } from "@/components/charts/chart-format";

const TONE: Record<(typeof STATUS_ORDER)[number], ChartTone> = { TODO: "neutral", IN_PROGRESS: "accent", BLOCKED: "danger", DONE: "good" };

// Overview charts are computed from the tasks loaded for this project.
export function ProjectOverview({ detail, partial, now, insights, onInspect, onOpenTab }: {
  detail: WorkDetail;
  partial: boolean;
  now: number;
  insights: WorkInsight[];
  onInspect: (insight: WorkInsight) => void;
  onOpenTab: (tab: "insights") => void;
}) {
  const tasks = detail.tasks;
  const stats = summarizeTasks(tasks, todayIso(now));
  const completions = completionsByWeek(tasks, now);
  const open = openTasksOverTime(tasks, now);
  const assignees = openByAssignee(tasks, (id) => memberName(detail.members, id));
  const openInsights = insights.filter((i) => !i.resolved_at);
  const scope = partial
    ? "Counts cover only the tasks on this page. Use the paging controls in Tasks to see the rest."
    : `Counts cover all ${stats.total} recorded tasks in this project.`;

  return (
    <div className="work-overview">
      <Section title="Health" description={scope}>
        <div className="work-stat-grid">
          <StatTile label="Tasks" value={formatNumber(stats.total)} note="Recorded in this project" />
          <StatTile label="Completed" value={stats.progress === null ? "No tasks" : formatPercent(stats.progress)} note={`${stats.done} of ${stats.total} done`} trend={completions.values} />
          <StatTile label="Open" value={formatNumber(stats.open)} note="Not yet done" />
          <StatTile label="Overdue" value={formatNumber(stats.overdue)} note="Unfinished and due before today (UTC)" />
          <StatTile label="Blocked" value={formatNumber(stats.blocked)} note="Status set to blocked" />
          <StatTile label="Unassigned" value={formatNumber(stats.unassigned)} note="Open tasks with no owner" />
          <StatTile label="Known remaining hours" value={formatNumber(stats.remainingHours)} note={`${stats.missingEstimates} open tasks have no estimate`} />
        </div>
      </Section>
      <Section title="Status and ownership" description="Task status is one distribution. Open work counts unfinished tasks per owner.">
        <div className="work-chart-grid">
          <StackedBar title="Task status" segments={STATUS_ORDER.map((s) => ({ id: s, label: STATUS_LABELS[s], value: tasks.filter((t) => t.status === s).length, tone: TONE[s] }))} emptyText="No tasks recorded yet." />
          <HBarChart title="Open work by assignee" items={assignees} emptyText="No open tasks." />
        </div>
      </Section>
      <Section title="Progress over time" description="From recorded creation and completion dates for the last eight weeks.">
        <div className="work-chart-grid">
          <BarChart title="Completed per week" categories={completions.starts.map((s) => formatDayShort(s))} series={[{ id: "done", label: "Completed", values: completions.values }]} emptyText="No completions in the last eight weeks." />
          <LineChart title="Open tasks over time" series={[{ id: "open", label: "Open", points: open }]} emptyText="No tasks recorded yet." />
        </div>
      </Section>
      <Section title="Open insights" description="Rule-based observations for this project. Suggestions require human judgment.">
        {!openInsights.length && <p>No open observations on the loaded insight page.</p>}
        {openInsights.length > 0 && (
          <ul className="work-plain-list">
            {openInsights.slice(0, 5).map((i) => (
              <li key={i.id}>
                <Badge tone="warning">{INSIGHT_LABELS[i.rule]}</Badge> {i.title}{" "}
                <Button variant="secondary" size="small" onClick={() => onInspect(i)}>Inspect evidence</Button>
              </li>
            ))}
          </ul>
        )}
        {openInsights.length > 5 && <Button variant="secondary" onClick={() => onOpenTab("insights")}>See all {openInsights.length} insights</Button>}
      </Section>
      {!tasks.length && <Alert tone="info">Create the first task to start the charts.</Alert>}
    </div>
  );
}
