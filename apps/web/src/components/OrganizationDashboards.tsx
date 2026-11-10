"use client";
import type { ReactNode } from "react";
import { BarChart, HBarChart, StatTile, formatDayShort, formatNumber, formatPercent } from "@/components/charts";
import { Section } from "@/components/ui";
import type { DashboardData, DashboardView, DataRow, OrgMetrics } from "@/lib/organization-api";
import { numberOf, rankByValue, weekEpoch } from "@/lib/organization-model";
import { DataTable } from "./DataTable";

export function formatCount(value: number | null): string {
  return value === null ? "Not recorded" : formatNumber(value);
}
export function formatHours(value: number | null): string {
  return value === null ? "Not recorded" : `${formatNumber(Math.round(value * 10) / 10)} h`;
}
export function formatDays(value: number | null): string {
  return value === null ? "Not enough data" : `${formatNumber(Math.round(value * 10) / 10)} days`;
}
export function formatRate(value: number | null): string {
  return value === null ? "Not enough data" : formatPercent(value);
}

// Every metric group carries its calculation beside it, as the design system requires.
function MethodNote({ children }: { children: ReactNode }) {
  return <details className="org-method"><summary>Method</summary>{children}</details>;
}

export function OverviewDashboard({ data, metrics, view }: { data: DashboardData; metrics: OrgMetrics | null; view: DashboardView }) {
  const scope = data.metrics;
  const summary = metrics?.summary;
  const weekly = metrics?.weekly ?? [];
  const missingEstimates = numberOf(scope, "missing_estimates") ?? 0;
  return (
    <div className="org-dashboard">
      <Section title="Your scope now" description="Current counts across every task you can see. These are not limited to the reporting window.">
        <div className="org-stat-row">
          <StatTile label="Tasks" value={formatCount(numberOf(scope, "tasks"))} />
          <StatTile label="Completed" value={formatCount(numberOf(scope, "completed"))} />
          <StatTile label="Blocked" value={formatCount(numberOf(scope, "blocked"))} />
          <StatTile label="Overdue" value={formatCount(numberOf(scope, "overdue"))} />
          <StatTile label="Known remaining hours" value={formatHours(numberOf(scope, "remaining_hours"))} note={`${formatNumber(missingEstimates)} unfinished tasks lack estimates.`} />
        </div>
        <MethodNote>
          <p>{data.method}</p>
          <p>Last task update: {scope.last_updated ? new Date(String(scope.last_updated)).toLocaleString() : "None"}.</p>
          <p>Lists show up to 100 records; metrics use all authorized records. Missing goals, budgets and availability are not inferred.</p>
        </MethodNote>
      </Section>

      <Section title="Delivery in the reporting window" description="Recorded activity across everything in your granted scope, over the window chosen above. Not limited to the role view.">
        {metrics ? (
          <>
            <div className="org-stat-row">
              <StatTile label="Open tasks" value={formatCount(numberOf(summary, "open_tasks"))} note="Not done, in your scope" />
              <StatTile
                label="Completed in window"
                value={formatCount(numberOf(summary, "completed_window"))}
                trend={weekly.map((row) => numberOf(row, "completed"))}
                note="Weekly trend"
              />
              <StatTile label="Median elapsed days" value={formatDays(numberOf(summary, "median_cycle_days"))} note="Creation to completion, for tasks finished in the window" />
              <StatTile label="On-time delivery" value={formatRate(numberOf(summary, "on_time_rate"))} note="Finished on or before the due date" />
              <StatTile
                label="Recorded hours"
                value={formatHours(numberOf(summary, "actual_hours"))}
                note={`Prorated allocation ${formatHours(numberOf(summary, "allocated_hours"))}, commitments ${formatHours(numberOf(summary, "committed_hours"))}. Scoped observations, not company-wide utilization.`}
              />
            </div>
            <BarChart
              title="Tasks completed per week"
              description={`Tasks completed in each ISO week of the last ${metrics.weeks}.`}
              categories={weekly.map((row) => {
                const epoch = weekEpoch(row.week_start);
                return epoch === null ? "Unknown" : formatDayShort(epoch);
              })}
              series={[{ id: "completed", label: "Completed", values: weekly.map((row) => numberOf(row, "completed")) }]}
              height={220}
              emptyText="No completions recorded in this window."
            />
            <MethodNote>
              <p>{metrics.method}</p>
              <p>Calculated {new Date(metrics.generatedAt).toLocaleString()}.</p>
            </MethodNote>
          </>
        ) : (
          <p className="org-muted" role="status">Loading the reporting window…</p>
        )}
      </Section>

      <Section title="Work lists" description="Records you can see right now. Lists show up to 100 entries.">
        <div className="org-table-grid">
          {view === "EMPLOYEE" && <DataTable title="My upcoming work" rows={data.tasks} columns={[["title", "Task"], ["project_name", "Project"], ["due_date", "Due"], ["status", "Status"]]} />}
          {data.projects && <DataTable title="Project portfolio" rows={data.projects} columns={[["name", "Project"], ["tasks", "Tasks"], ["completed", "Completed"], ["blocked", "Blocked"]]} />}
          {data.dependencies && <DataTable title="Cross-department dependencies" rows={data.dependencies} columns={[["dependent_project", "Dependent project"], ["prerequisite_project", "Prerequisite project"], ["title", "Prerequisite"], ["status", "Status"]]} />}
          <DataTable
            title={view === "EMPLOYEE" ? "Observations affecting my work" : "Risks requiring review"}
            rows={data.risks}
            columns={[["title", "Evidence task"], ["project_name", "Project"], ["rule", "Condition"], ["triage_status", "Review"]]}
          />
        </div>
        <p className="org-muted">Open Work &amp; insights to inspect task evidence, edit work, or triage observations.</p>
      </Section>
    </div>
  );
}

export function TeamsDashboard({ data, metrics }: { data: DashboardData; metrics: OrgMetrics | null }) {
  const teamItems = metrics?.teams ? rankByValue(metrics.teams, "completed_window", groupDetail) : null;
  const departmentItems = metrics?.departments ? rankByValue(metrics.departments, "completed_window", groupDetail) : null;
  const hasAnything = teamItems || departmentItems || data.teams || data.departments || data.resourceGaps;
  return (
    <div className="org-dashboard">
      {!hasAnything && <p className="org-empty">No teams or departments are visible in your scope.</p>}
      {teamItems && (
        <Section title="Team delivery" description="Completed in the reporting window, ranked. Detail shows open, blocked, and overdue counts.">
          <HBarChart title="Completed per team" items={teamItems} emptyText="No teams are visible in this window." />
          {metrics && <MethodNote><p>{metrics.method}</p></MethodNote>}
        </Section>
      )}
      {departmentItems && (
        <Section title="Department delivery" description="Completed in the reporting window, ranked by department.">
          <HBarChart title="Completed per department" items={departmentItems} emptyText="No departments are visible in this window." />
          {metrics && <MethodNote><p>{metrics.method}</p></MethodNote>}
        </Section>
      )}
      {(data.teams || data.departments || data.resourceGaps) && (
        <Section title="Delivery records" description="Counts for the teams and departments in your current role view.">
          <div className="org-table-grid">
            {data.teams && <DataTable title="Team delivery" rows={data.teams} columns={[["name", "Team"], ["projects", "Projects"], ["tasks", "Tasks"], ["completed", "Completed"], ["blocked", "Blocked"]]} />}
            {data.departments && <DataTable title="Department delivery" rows={data.departments} columns={[["name", "Department"], ["projects", "Projects"], ["tasks", "Tasks"], ["completed", "Completed"], ["blocked", "Blocked"]]} />}
            {data.resourceGaps && <DataTable title="Department resource gaps" rows={data.resourceGaps} columns={[["name", "Department"], ["unassigned", "Unassigned work"], ["missing_estimates", "Missing estimates"], ["remaining_hours", "Known effort"]]} />}
          </div>
        </Section>
      )}
    </div>
  );
}

export function PeopleDashboard({ data, metrics, view }: { data: DashboardData; metrics: OrgMetrics | null; view: DashboardView }) {
  const people = metrics?.people ? rankByValue(metrics.people, "open_tasks", (row) => `${formatHours(numberOf(row, "actual_hours"))} recorded, ${formatHours(numberOf(row, "allocated_hours"))} prorated allocation`) : null;
  return (
    <div className="org-dashboard">
      {people && (
        <Section title="Open tasks by person" description="People in your scope, ranked by open tasks. Missing hours are not inferred.">
          <HBarChart title="Open tasks per person" items={people} emptyText="No people are visible in this scope." />
          {metrics && <MethodNote><p>{metrics.method}</p></MethodNote>}
        </Section>
      )}
      {view === "MANAGER" && (
        <Section title="Workload and reporting" description="Recorded workload by owner, and the reporting hierarchy you manage.">
          <div className="org-table-grid">
            <DataTable title="Recorded workload by owner" rows={data.workload ?? []} columns={[["name", "Owner (blank means unassigned)"], ["tasks", "Open tasks"], ["estimated_hours", "Estimated hours"], ["missing_estimates", "Missing estimates"]]} />
            <DataTable title="Reporting hierarchy" rows={data.reports ?? []} columns={[["name", "Reports in your hierarchy"]]} />
          </div>
        </Section>
      )}
    </div>
  );
}

// Detail under a team or department bar: the current state, so a short window still shows open risk.
function groupDetail(row: DataRow): string {
  return `${formatCount(numberOf(row, "tasks"))} tasks · ${formatCount(numberOf(row, "blocked"))} blocked · ${formatCount(numberOf(row, "overdue"))} overdue`;
}
