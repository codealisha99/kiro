"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Field, PageHeader, PageTabs, Select } from "@/components/ui";
import { orgApi, type DashboardData, type DashboardView, type OrgMetrics, type OrgSetup } from "@/lib/organization-api";
import { ORG_TAB_LABELS, resolveOrgTab, visibleOrgTabs, type OrgTab } from "@/lib/organization-model";
import IntegrationsPanel from "./IntegrationsPanel";
import { isOAuthReturn } from "./shell/nav";
import OrganizationExplorer from "./OrganizationExplorer";
import OrganizationSetup from "./OrganizationSetup";
import { OverviewDashboard, PeopleDashboard, TeamsDashboard } from "./OrganizationDashboards";
import "./organization.css";

// ProjectPlanning imports this table from the organization screen; keep the export stable.
export { DataTable } from "./DataTable";

const views: Record<DashboardView, { title: string; description: string }> = {
  EMPLOYEE: { title: "My workday", description: "Your assigned work, upcoming deadlines, and observations that need your attention." },
  MANAGER: { title: "Team delivery", description: "Ownership, recorded workload, blockers, and your reporting relationships." },
  DIRECTOR: { title: "Department delivery", description: "Compare authorized teams and review project execution across your departments." },
  VP: { title: "Department portfolio", description: "Department-level delivery and resource gaps across your explicitly granted scope." },
  CEO: { title: "Company overview", description: "Cross-department dependencies, project portfolios, and material recorded risks within your granted scope." },
};
const WINDOWS = [1, 2, 4, 8, 12];
const TAB_COPY: Record<OrgTab, { title: string; subtitle: string }> = {
  overview: { title: "", subtitle: "" },
  teams: { title: "Teams & departments", subtitle: "Delivery by team and department, ranked within the window." },
  people: { title: "People", subtitle: "Open work and recorded effort for people in your reporting scope." },
  explorer: { title: "Explorer", subtitle: "Explicit relationships and recorded activity within your current project permissions." },
  connections: { title: "Connections", subtitle: "Connected applications and the records they have synchronized." },
  setup: { title: "Setup", subtitle: "Departments, teams, membership, reporting lines, and roles." },
};

export default function OrganizationWorkspace() {
  const [setup, setSetup] = useState<OrgSetup | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [metrics, setMetrics] = useState<OrgMetrics | null>(null);
  const [view, setView] = useState<DashboardView>("EMPLOYEE");
  const [weeks, setWeeks] = useState(8);
  const [tab, setTab] = useState<OrgTab>("overview");
  const [error, setError] = useState("");
  const [metricsError, setMetricsError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOAuthReturn(window.location.search)) setTab("connections");
  }, []);

  const reload = useCallback(async () => { setSetup(await orgApi.setup()); }, []);

  // A role switch clears the old role's data so nothing from another scope is shown under the new title.
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setData(null);
    Promise.all([orgApi.setup(), orgApi.dashboard(view)])
      .then(([s, d]) => { if (active) { setSetup(s); setData(d); } })
      .catch((e) => { if (active) { setSetup(null); setError((e as Error).message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [view]);

  // A new window keeps the previous render until the recalculated metrics arrive.
  useEffect(() => {
    let active = true;
    setMetricsError("");
    orgApi.metrics(weeks)
      .then((m) => { if (active) setMetrics(m); })
      .catch((e) => { if (active) setMetricsError((e as Error).message); });
    return () => { active = false; };
  }, [weeks]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await fn(); await reload(); }
    catch (e) { setError((e as Error).message); throw e; }
    finally { setBusy(false); }
  }
  async function refresh() {
    await act(async () => {
      const [d, m] = await Promise.all([orgApi.dashboard(view), orgApi.metrics(weeks)]);
      setData(d); setMetrics(m); setMetricsError("");
    }).catch(() => {});
  }

  const access = { views: setup?.views ?? ["EMPLOYEE"], canManage: !!setup?.canManage, canManageIntegrations: !!setup?.canManageIntegrations };
  const visible = visibleOrgTabs(access);
  const active = resolveOrgTab(tab, visible);
  const dashboardTab = active === "overview" || active === "teams" || active === "people";
  const copy = active === "overview" ? { title: views[view].title, subtitle: views[view].description } : { title: TAB_COPY[active].title, subtitle: TAB_COPY[active].subtitle };

  return (
    <section className="organization-workspace" aria-busy={busy || loading}>
      <PageHeader
        eyebrow="Organization"
        title={copy.title}
        subtitle={copy.subtitle}
        meta={data && dashboardTab ? <span>Calculated {new Date(data.calculatedAt).toLocaleString()}. Only your currently authorized data is included.</span> : undefined}
        actions={<Button variant="secondary" disabled={busy || loading} onClick={() => void refresh()}>Refresh</Button>}
        tabs={<PageTabs items={visible.map((id) => ({ id, label: ORG_TAB_LABELS[id] }))} value={active} onChange={setTab} label="Company views" />}
      />
      {error && <Alert tone="danger">{error} Refresh to recheck access.</Alert>}
      {loading && <p role="status">Loading your authorized scope…</p>}
      {dashboardTab && (
        <div className="org-filter-row">
          <div className="org-view-switch" role="group" aria-label="Dashboard role">
            {(setup?.views ?? ["EMPLOYEE"]).map((v) => (
              <Button key={v} variant={view === v ? "primary" : "secondary"} size="small" aria-pressed={view === v} disabled={busy} onClick={() => setView(v)}>{views[v].title}</Button>
            ))}
          </div>
          <Field label="Reporting window">{(f) => (
            <Select {...f} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              {WINDOWS.map((w) => <option value={w} key={w}>{w} week{w === 1 ? "" : "s"}</option>)}
            </Select>
          )}</Field>
        </div>
      )}
      {metricsError && dashboardTab && <Alert tone="warning">Metrics for this window are unavailable: {metricsError}</Alert>}
      {active === "overview" && data && <OverviewDashboard data={data} metrics={metrics} view={view} />}
      {active === "teams" && data && <TeamsDashboard data={data} metrics={metrics} />}
      {active === "people" && data && <PeopleDashboard data={data} metrics={metrics} view={view} />}
      {active === "explorer" && <OrganizationExplorer />}
      {active === "connections" && setup?.canManageIntegrations && <IntegrationsPanel />}
      {active === "setup" && setup?.canManage && <OrganizationSetup setup={setup} busy={busy} act={act} />}
    </section>
  );
}
