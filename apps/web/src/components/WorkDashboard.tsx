"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { Alert, Badge, Button, Dialog, Field, Input, PageHeader } from "@/components/ui";
import { orgApi, type DataRow } from "@/lib/organization-api";
import { workApi, type WorkDetail, type WorkInsight, type WorkNotification, type WorkOverview, type WorkProject, type WorkScenario } from "@/lib/work-api";
import { projectSummary, todayIso, type ProjectSummary } from "@/lib/work-metrics";
import { ProjectList } from "./work/ProjectList";
import { ProjectView, type ProjectTab } from "./work/ProjectView";
import { WorkspaceOverview } from "./work/WorkspaceOverview";
import { INSIGHT_LABELS, INSIGHT_RECOMMENDATIONS } from "./work/insight-copy";
import { useAction } from "./work/use-action";
import { useWorkShortcuts } from "./work/use-work-shortcuts";
import "./work-dashboard.css";

// A focus request (from a notification) opens one project on a given tab. It only applies to that project.
type Focus = { projectId: string; tab: ProjectTab; scenario: WorkScenario | null };

export default function WorkDashboard() {
  const [now, setNow] = useState(() => Date.now());
  const [overview, setOverview] = useState<WorkOverview | null>(null);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ProjectSummary>>({});
  const [teams, setTeams] = useState<DataRow[]>([]);
  const [insights, setInsights] = useState<WorkInsight[]>([]);
  const [notifications, setNotifications] = useState<WorkNotification[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [viewKey, setViewKey] = useState(0);
  const [projectOffset, setProjectOffset] = useState(0);
  const [insightOffset, setInsightOffset] = useState(0);
  const [evidence, setEvidence] = useState<WorkInsight | null>(null);
  const [canTriage, setCanTriage] = useState(false);
  const [triageReason, setTriageReason] = useState("");
  const page = useAction();
  useWorkShortcuts({ moveRows: true });

  // Stable for the whole visit: ProjectView's load effect depends on it, so a dashboard reload
  // must not reset the open project's task page. The current time is read through a ref.
  const nowRef = useRef(now);
  nowRef.current = now;
  const handleDetail = useCallback((detail: WorkDetail) => {
    setSummaries((current) => ({ ...current, [detail.project.id]: projectSummary(detail.project, detail.tasks, todayIso(nowRef.current)) }));
  }, []);

  // Project progress comes from each project's detail, because the project list has no counts.
  const loadPage = useCallback(async () => {
    const stamp = Date.now();
    const [o, p, i, n, t] = await Promise.all([
      workApi.overview(),
      workApi.projects(projectOffset),
      workApi.insights(insightOffset),
      workApi.notifications(),
      orgApi.teams(),
    ]);
    const details = await Promise.allSettled(p.map((project) => workApi.detail(project.id)));
    const next: Record<string, ProjectSummary> = {};
    details.forEach((result, index) => {
      if (result.status === "fulfilled") next[p[index].id] = projectSummary(p[index], result.value.tasks, todayIso(stamp));
    });
    setNow(stamp);
    setOverview(o);
    setProjects(p);
    setInsights(i);
    setNotifications(n);
    setTeams(t);
    setSummaries(next);
  }, [projectOffset, insightOffset]);

  const runPage = page.run;
  useEffect(() => {
    void runPage(loadPage);
  }, [loadPage, runPage]);

  function selectProject(id: string | null, request?: Focus) {
    setSelectedId(id);
    setFocus(request ?? null);
    setViewKey((k) => k + 1);
  }

  async function refresh() {
    await page.run(async () => {
      await loadPage();
      setViewKey((k) => k + 1);
    });
  }

  async function createProject(name: string): Promise<boolean> {
    let created = false;
    await page.run(async () => {
      const project = await workApi.createProject(name);
      created = true;
      await loadPage();
      selectProject(project.id);
    });
    return created;
  }

  async function inspectInsight(insight: WorkInsight) {
    await page.run(async () => {
      // Recheck current access before opening saved evidence.
      const current = await workApi.detail(insight.project_id);
      setCanTriage(!!current.project.can_write);
      setTriageReason("");
      setEvidence(insight);
    });
  }

  async function markRead(n: WorkNotification) {
    await page.run(async () => {
      await workApi.readNotification(n.id);
      setNotifications((current) => current.map((item) => (item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item)));
    });
  }

  async function reviewScenario(n: WorkNotification) {
    await page.run(async () => {
      const scenario = await workApi.scenarioResult(n.resource_id);
      if (!n.read_at) {
        await workApi.readNotification(n.id);
        setNotifications((current) => current.map((item) => (item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item)));
      }
      selectProject(scenario.project_id, { projectId: scenario.project_id, tab: "scenarios", scenario });
    });
  }

  async function triage(status: WorkInsight["triage_status"]) {
    if (!evidence) return;
    await page.run(async () => {
      await workApi.triage(evidence.id, status, triageReason, evidence.triage_version);
      setEvidence(null);
      await loadPage();
    });
  }

  const unread = notifications.filter((n) => !n.read_at).length;
  const teamNames = Object.fromEntries(teams.map((t) => [String(t.id), String(t.name)]));
  const focusApplies = focus !== null && focus.projectId === selectedId;
  const initialLoading = !overview && !page.error;

  return (
    <section className="work-screen shell-page" aria-busy={page.busy}>
      {selectedId === null && (
        <PageHeader
          eyebrow="Organizational intelligence"
          title="Projects & tasks"
          subtitle="Recorded work, emerging risks, and the evidence behind them."
          meta={overview && <><span>{overview.scope}</span><span>Calculated {new Date(overview.calculatedAt).toLocaleString()}</span></>}
          actions={<Button variant="secondary" disabled={page.busy} onClick={() => void refresh()}>Refresh</Button>}
        />
      )}
      {page.error && <Alert tone="danger">{page.error} Access may have changed. Refresh to reload authorized records.</Alert>}
      {initialLoading && <p role="status">Loading authorized work…</p>}
      {overview && (
        <div className={`work-layout${selectedId ? " has-project" : ""}`}>
          <aside className="work-list-pane" aria-label="Projects">
            <ProjectList
              projects={projects}
              summaries={summaries}
              teamNames={teamNames}
              selectedId={selectedId}
              unread={unread}
              offset={projectOffset}
              loading={page.busy}
              busy={page.busy}
              onSelect={(id) => selectProject(id)}
              onCreate={createProject}
              onPage={(delta) => setProjectOffset((o) => Math.max(0, o + delta))}
              onRefresh={() => void refresh()}
            />
          </aside>
          <div className="work-main">
            {selectedId && (
              <Button variant="secondary" size="small" className="work-back" onClick={() => selectProject(null)}>All projects</Button>
            )}
            {selectedId ? (
              <ProjectView
                key={`${selectedId}:${viewKey}`}
                projectId={selectedId}
                projects={projects}
                insights={insights}
                now={now}
                initialTab={focusApplies && focus ? focus.tab : "overview"}
                initialScenario={focusApplies && focus ? focus.scenario : null}
                onDetail={handleDetail}
                onInspect={(i) => void inspectInsight(i)}
              />
            ) : (
              <WorkspaceOverview
                overview={overview}
                notifications={notifications}
                insights={insights}
                insightOffset={insightOffset}
                busy={page.busy}
                onReview={(n) => void reviewScenario(n)}
                onMarkRead={(n) => void markRead(n)}
                onInspect={(i) => void inspectInsight(i)}
                onInsightPage={(delta) => setInsightOffset((o) => Math.max(0, o + delta))}
              />
            )}
          </div>
        </div>
      )}
      <Dialog open={!!evidence} onClose={() => setEvidence(null)} closeDisabled={page.busy} title="Insight evidence">
        {evidence && <>
          <Badge>Calculated observation</Badge>
          <h3>{INSIGHT_LABELS[evidence.rule]}</h3>
          {page.error && <Alert tone="danger">{page.error}</Alert>}
          <p>Task: {evidence.title}</p>
          <p>Observed version: {evidence.evidence_version}. Status: {evidence.evidence_status}. Due: {evidence.evidence_due_date ?? "Not set"}.</p>
          <p>Detected {new Date(evidence.detected_at).toLocaleString()}. {evidence.resolved_at ? `Resolved ${new Date(evidence.resolved_at).toLocaleString()}.` : "Active at the last refresh."}</p>
          <p>Source: manually recorded task {evidence.task_id}. Current task title may differ from the historical version.</p>
          <p>Suggested next step: {INSIGHT_RECOMMENDATIONS[evidence.rule]}</p>
          <p>Review status: {evidence.triage_status.toLowerCase()}. {evidence.triage_reason}</p>
          <p>The condition resolves when the task no longer triggers this rule. Task changes reopen dismissed or acknowledged observations for review.</p>
          {!evidence.resolved_at && canTriage && (
            <div className="work-form">
              <Field label="Review reason" hint="Required when dismissing an observation.">{(f) => (
                <Input {...f} maxLength={1000} disabled={page.busy} value={triageReason} onChange={(e) => setTriageReason(e.target.value)} />
              )}</Field>
              <div className="work-actions">
                {(["ACKNOWLEDGED", "DISMISSED", "OPEN"] as const).filter((s) => s !== evidence.triage_status).map((status) => (
                  <Button key={status} variant="secondary" disabled={page.busy || (status === "DISMISSED" && !triageReason.trim())} onClick={() => void triage(status)}>
                    {status === "ACKNOWLEDGED" ? "Acknowledge" : status === "DISMISSED" ? "Dismiss with reason" : "Reopen for review"}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>}
      </Dialog>
    </section>
  );
}
