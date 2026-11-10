import type { DashboardView, DataRow } from "./organization-api";

export type OrgTab = "overview" | "teams" | "people" | "explorer" | "connections" | "setup";
export type Tone = "success" | "warning" | "danger" | "neutral";

export const ORG_TAB_LABELS: Record<OrgTab, string> = {
  overview: "Overview",
  teams: "Teams & departments",
  people: "People",
  explorer: "Explorer",
  connections: "Connections",
  setup: "Setup",
};

export const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;

// Tabs follow what the viewer may read. Explorer and overview are always available.
export function visibleOrgTabs(access: {
  views: readonly DashboardView[];
  canManage: boolean;
  canManageIntegrations: boolean;
}): OrgTab[] {
  const tabs: OrgTab[] = ["overview"];
  if (access.views.some((view) => view !== "EMPLOYEE")) tabs.push("teams");
  if (access.views.includes("MANAGER")) tabs.push("people");
  tabs.push("explorer");
  if (access.canManageIntegrations) tabs.push("connections");
  if (access.canManage) tabs.push("setup");
  return tabs;
}

export function resolveOrgTab(tab: OrgTab, visible: readonly OrgTab[]): OrgTab {
  return visible.includes(tab) ? tab : "overview";
}

// Metric cells arrive as numbers or numeric strings. Missing data stays null rather than zero.
export function numberOf(row: DataRow | undefined, key: string): number | null {
  const value = row?.[key];
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Week starts are date-only strings; read them as UTC so labels match on server and client.
export function weekEpoch(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface RankedItem {
  id: string;
  label: string;
  value: number | null;
  detail?: string;
}

// Sorts a copy; unknown values sink to the bottom so they are never shown as zero.
export function rankByValue(rows: readonly DataRow[], valueKey: string, detail?: (row: DataRow) => string): RankedItem[] {
  return rows
    .map((row, index): RankedItem => ({
      id: String(row.id ?? index),
      label: String(row.name ?? "Unnamed"),
      value: numberOf(row, valueKey),
      detail: detail?.(row),
    }))
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || a.label.localeCompare(b.label));
}

const CONNECTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  READY: { label: "Ready", tone: "success" },
  PENDING: { label: "Waiting for first sync", tone: "warning" },
  OAUTH_TENANT: { label: "Choose an organization", tone: "warning" },
  OAUTH_AUTHORIZING: { label: "Awaiting consent", tone: "warning" },
  UNCONFIGURED: { label: "Not configured", tone: "neutral" },
  DISCONNECTED: { label: "Disconnected", tone: "neutral" },
  REAUTH: { label: "Needs reauthorization", tone: "danger" },
  FAILED: { label: "Failed", tone: "danger" },
  DELETED: { label: "Deleted", tone: "neutral" },
};

export function connectionStatus(status: string): { label: string; tone: Tone } {
  return CONNECTION_STATUS[status] ?? { label: status.replaceAll("_", " ").toLowerCase(), tone: "warning" };
}

export function relativeTime(then: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return "just now";
  const units: [number, string][] = [
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [size, unit] of units) {
    const amount = Math.floor(seconds / size);
    if (amount >= 1) return `${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

// Records are withheld after 24 hours without a complete successful sync, so the freshness line says so.
export function syncFreshness(lastSuccessAt: string | null | undefined, now: number): { tone: Tone; text: string } {
  if (!lastSuccessAt) return { tone: "neutral", text: "No complete sync yet" };
  const then = Date.parse(lastSuccessAt);
  if (!Number.isFinite(then)) return { tone: "neutral", text: "Last sync time not recorded" };
  if (now - then > FRESHNESS_WINDOW_MS) {
    return { tone: "warning", text: `Stale, last complete sync ${relativeTime(then, now)}. Records are withheld until a sync succeeds.` };
  }
  return { tone: "success", text: `Fresh, synced ${relativeTime(then, now)}` };
}
