"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { Alert, Badge, Button, Dialog, PageHeader, PageTabs, Section } from "@/components/ui";
import { formatPercent } from "@/components/charts";
import type { DataRow } from "@/lib/organization-api";
import { workApi, type WorkDetail, type WorkInsight, type WorkProject, type WorkScenario } from "@/lib/work-api";
import { parsePayload, summarizeTasks, todayIso } from "@/lib/work-metrics";
import ProjectActions from "../ProjectActions";
import ProjectPlanning from "../ProjectPlanning";
import ProjectSources from "../ProjectSources";
import { ProjectAccess } from "./ProjectAccess";
import { ProjectInsights } from "./ProjectInsights";
import { ProjectOverview } from "./ProjectOverview";
import { ProjectScenarios } from "./ProjectScenarios";
import { ProjectTasks } from "./ProjectTasks";
import { TaskPanel } from "./TaskPanel";
import { type PlannedTasks } from "./TaskList";
import { errorMessage, useAction } from "./use-action";
import { useWorkShortcuts } from "./use-work-shortcuts";

export type ProjectTab = "overview" | "tasks" | "planning" | "insights" | "scenarios" | "delivery" | "access";
type HistoryEvent = Awaited<ReturnType<typeof workApi.history>>[number];
type Panel = { mode: "closed" | "create" | "edit"; taskId: string | null };
const PAGE = 100;

// One project: header, tabs, and the task panel. Owns this project's data; the parent keys it by project.
export function ProjectView({ projectId, projects, teams, insights, now, initialTab, initialScenario, onChanged, onInspect }: {
  projectId: string;
  projects: WorkProject[];
  teams: DataRow[];
  insights: WorkInsight[];
  now: number;
  initialTab: ProjectTab;
  initialScenario: WorkScenario | null;
  onChanged: () => void;
  onInspect: (insight: WorkInsight) => void;
}) {
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [planned, setPlanned] = useState<PlannedTasks>({});
  const [plannedError, setPlannedError] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<ProjectTab>(initialTab);
  const [panel, setPanel] = useState<Panel>({ mode: "closed", taskId: null });
  const [pendingScenario, setPendingScenario] = useState(initialScenario);
  const [history, setHistory] = useState<HistoryEvent[] | null>(null);
  const historyAction = useAction();

  // Only the newest load may write state, so a slow earlier page can't overwrite a later one.
  const generation = useRef(0);
  const reload = useCallback(async (nextOffset: number, changed = true) => {
    const run = ++generation.current;
    const planning = workApi.planning(projectId).then(
      (snapshot) => ({ snapshot, error: "" }),
      (e: unknown) => ({ snapshot: null, error: errorMessage(e) }),
    );
    const [next, plan] = await Promise.all([workApi.detail(projectId, nextOffset), planning]);
    if (run !== generation.current) return;
    setDetail(next);
    setOffset(nextOffset);
    setPlanned(plan.snapshot ? Object.fromEntries(plan.snapshot.task_planning.map((p) => [p.task_id, p])) : {});
    setPlannedError(plan.error);
    if (changed) onChanged();
  }, [projectId, onChanged]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    reload(0, false)
      .catch((e: unknown) => { if (active) setLoadError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const openTask = useCallback((taskId: string) => setPanel({ mode: "edit", taskId }), []);
  const openCreate = useCallback(() => {
    setTab("tasks");
    setPanel({ mode: "create", taskId: null });
  }, []);
  const closePanel = useCallback(() => {
    if (panel.mode === "closed") return;
    const returnTo = panel.taskId;
    setPanel({ mode: "closed", taskId: null });
    // Return focus to the row that opened the panel, if it is still on the page.
    requestAnimationFrame(() => {
      [...document.querySelectorAll<HTMLElement>("[data-row-id]")].find((el) => el.dataset.rowId === returnTo)?.focus();
    });
  }, [panel]);

  const canWrite = !!detail?.project.can_write;
  useWorkShortcuts({ onCreate: canWrite ? openCreate : undefined, onEscape: closePanel });

  if (loading && !detail) return <p role="status">Loading project…</p>;
  if (!detail) return <Alert tone="danger">{loadError || "This project could not be loaded."} Access may have changed. Refresh to reload authorized records.</Alert>;

  const project = detail.project;
  const today = todayIso(now);
  const stats = summarizeTasks(detail.tasks, today);
  const teamRow = teams.find((t) => String(t.id) === project.team_id);
  const teamName = teamRow ? String(teamRow.name) : undefined;
  const projectInsights = insights.filter((i) => i.project_id === projectId);
  const openProjectInsights = projectInsights.filter((i) => !i.resolved_at).length;
  const selectedTask = detail.tasks.find((t) => t.id === panel.taskId) ?? null;
  const panelOpen = panel.mode === "create" || (panel.mode === "edit" && selectedTask !== null);
  const partial = detail.tasks.length >= PAGE || offset > 0;
  const tabs: { id: ProjectTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "tasks", label: "Tasks", count: detail.tasks.length },
    { id: "planning", label: "Planning" },
    { id: "insights", label: "Insights", count: openProjectInsights },
    { id: "scenarios", label: "Scenarios" },
    { id: "delivery", label: "Sources & actions" },
    { id: "access", label: "Access" },
  ];

  return (
    <div className="work-project">
      {loadError && <Alert tone="danger">{loadError}</Alert>}
      {plannedError && <Alert tone="warning">Task priorities are unavailable: {plannedError}</Alert>}
      <PageHeader
        eyebrow={teamName ?? "No team"}
        title={project.name}
        subtitle={canWrite ? "You can edit this project." : "Read-only project access."}
        meta={<>
          <span>{stats.total} tasks</span>
          <span>{stats.progress === null ? "No tasks yet" : `${formatPercent(stats.progress)} complete`}</span>
          <Badge tone={project.restricted === false ? "info" : "neutral"}>{project.restricted === false ? "Shared with team" : "Restricted"}</Badge>
        </>}
        actions={<>
          <Button variant="secondary" disabled={historyAction.busy} onClick={() => void historyAction.run(async () => setHistory(await workApi.history(projectId)))}>Change history</Button>
          {canWrite && <Button onClick={openCreate}>New task <span className="work-kbd" aria-hidden="true">c</span></Button>}
        </>}
        tabs={<PageTabs items={tabs} value={tab} onChange={setTab} label="Project sections" />}
      />
      {historyAction.error && <Alert tone="danger">{historyAction.error}</Alert>}
      {tab === "overview" && (
        <ProjectOverview detail={detail} partial={partial} now={now} insights={projectInsights} onInspect={onInspect} onOpenTab={setTab} />
      )}
      {tab === "tasks" && (
        <div className={`work-tasks-layout${panelOpen ? " has-panel" : ""}`}>
          <ProjectTasks
            detail={detail}
            planned={planned}
            today={today}
            canWrite={canWrite}
            selectedId={panelOpen ? panel.taskId : null}
            offset={offset}
            onOpen={openTask}
            onPage={reload}
          />
          {panelOpen && (
            <TaskPanel
              key={`${panel.mode}-${panel.taskId ?? "new"}`}
              projectId={projectId}
              mode={panel.mode === "create" ? "create" : "edit"}
              task={selectedTask}
              members={detail.members}
              canWrite={canWrite}
              planned={selectedTask ? planned[selectedTask.id] : undefined}
              today={today}
              onClose={closePanel}
              onReload={() => reload(offset)}
              onOpen={openTask}
            />
          )}
        </div>
      )}
      {tab === "planning" && (
        <ProjectPlanning key={project.id} detail={detail} projects={projects} onChanged={() => void reload(offset)} />
      )}
      {tab === "insights" && <ProjectInsights insights={projectInsights} onInspect={onInspect} />}
      {tab === "scenarios" && (
        <ProjectScenarios projectId={projectId} canWrite={canWrite} viewerId={detail.viewer_id} pendingScenario={pendingScenario} onPendingHandled={() => setPendingScenario(null)} />
      )}
      {tab === "delivery" && (
        <Section title="Sources and provider actions" description="Explicitly shared sources and approved provider actions for this project.">
          <div className="work-stack">
            <ProjectSources key={project.id} projectId={project.id} canWrite={canWrite} />
            <ProjectActions key={project.id} detail={detail} />
          </div>
        </Section>
      )}
      {tab === "access" && (
        <ProjectAccess detail={detail} teams={teams} reload={() => reload(offset)} />
      )}
      <Dialog open={!!history} onClose={() => setHistory(null)} title="Project change history">
        <p>Most recent 100 authorized events. Earlier task versions remain preserved.</p>
        <ul className="work-plain-list">{history?.map((e) => (
          <li key={e.id}>
            <strong>{e.kind.replaceAll("_", " ")}</strong>
            <p>{new Date(e.occurred_at).toLocaleString()}</p>
            <details><summary>Recorded evidence</summary><pre>{JSON.stringify(parsePayload(e.payload) ?? e.payload, null, 2)}</pre></details>
          </li>
        ))}</ul>
      </Dialog>
    </div>
  );
}
