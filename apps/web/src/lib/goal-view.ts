// Pure view models for the Home and Goals screens: filters, alignment tree, and chart series.
import type { Goal, GoalCheckin, GoalHealth, GoalScope, TaskSummary, TaskStatus, ThroughputResponse } from "./home-api";
import { groupGoalsByScope, parseDay, SCOPE_ORDER } from "./goal-format";

export type GoalFilter = "all" | "mine" | "risk" | GoalScope;

export const GOAL_FILTER_LABELS: Record<GoalFilter, string> = {
  all: "All",
  mine: "Mine",
  risk: "At risk",
  COMPANY: "Company",
  DEPARTMENT: "Department",
  TEAM: "Team",
  PERSON: "Personal",
};

export const GOAL_FILTERS: GoalFilter[] = ["all", "mine", "COMPANY", "DEPARTMENT", "TEAM", "PERSON", "risk"];

const RISK_HEALTH: GoalHealth[] = ["AT_RISK", "OFF_TRACK"];

export function matchesFilter(goal: Goal, filter: GoalFilter): boolean {
  if (filter === "all") return true;
  if (filter === "mine") return goal.mine;
  if (filter === "risk") return RISK_HEALTH.includes(goal.health);
  return goal.scope === filter;
}

export function filterCounts(goals: Goal[]): Record<GoalFilter, number> {
  return Object.fromEntries(GOAL_FILTERS.map((filter) => [filter, goals.filter((goal) => matchesFilter(goal, filter)).length])) as Record<GoalFilter, number>;
}

/** Scope rank so roots and home lists follow company, department, team, personal. */
function scopeRank(goal: Goal): number {
  return SCOPE_ORDER.indexOf(goal.scope);
}

export interface TreeRow {
  goal: Goal;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  /** Shown only to give a matching descendant its context; the goal itself does not match the filter. */
  context: boolean;
}

/**
 * Flattens goals into alignment-tree rows. A goal is a root when its parent is absent from the list,
 * so goals whose parent the viewer cannot read still appear. Filtered-out goals stay visible as context
 * when a matching descendant needs them.
 */
export function treeRows(goals: Goal[], filter: GoalFilter, collapsed: ReadonlySet<string>): TreeRow[] {
  const byId = new Map(goals.map((goal) => [goal.id, goal]));
  const matching = new Set(goals.filter((goal) => matchesFilter(goal, filter)).map((goal) => goal.id));
  const keep = new Set<string>();
  for (const id of matching) {
    let cursor: Goal | undefined = byId.get(id);
    while (cursor && !keep.has(cursor.id)) {
      keep.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
  }
  const visible = goals.filter((goal) => keep.has(goal.id));
  const childrenOf = (parentId: string | null) => visible
    .filter((goal) => (goal.parentId && byId.has(goal.parentId) ? goal.parentId : null) === parentId)
    .sort((a, b) => scopeRank(a) - scopeRank(b) || a.title.localeCompare(b.title));

  const rows: TreeRow[] = [];
  const walk = (goal: Goal, depth: number) => {
    const children = childrenOf(goal.id);
    const expanded = !collapsed.has(goal.id);
    rows.push({ goal, depth, hasChildren: children.length > 0, expanded, context: !matching.has(goal.id) });
    if (expanded) children.forEach((child) => walk(child, depth + 1));
  };
  childrenOf(null).forEach((root) => walk(root, 0));
  return rows;
}

export type GoalListMode = "list" | "tree";

/** Goal ids in the order they appear on screen, used for j/k navigation. */
export function visibleGoalOrder(goals: Goal[], filter: GoalFilter, mode: GoalListMode, collapsed: ReadonlySet<string>): Goal[] {
  if (mode === "tree") return treeRows(goals, filter, collapsed).map((row) => row.goal);
  return groupGoalsByScope(goals.filter((goal) => matchesFilter(goal, filter))).flatMap((group) => group.goals);
}

/** Goals ordered for compact lists: the viewer's own first, then scope order, then title. */
export function prioritizedGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => Number(b.mine) - Number(a.mine) || scopeRank(a) - scopeRank(b) || a.title.localeCompare(b.title));
}

/** On-track ratio: cancelled goals are left out; achieved goals count as on track. */
export function onTrackRatio(goals: Goal[]): { onTrack: number; total: number } {
  const active = goals.filter((goal) => goal.health !== "CANCELLED");
  const onTrack = active.filter((goal) => goal.health === "ON_TRACK" || goal.health === "ACHIEVED").length;
  return { onTrack, total: active.length };
}

const HEALTH_SEGMENTS: { health: GoalHealth; label: string; tone: "good" | "warning" | "danger" | "accent" | "neutral" }[] = [
  { health: "ON_TRACK", label: "On track", tone: "good" },
  { health: "AT_RISK", label: "At risk", tone: "warning" },
  { health: "OFF_TRACK", label: "Off track", tone: "danger" },
  { health: "ACHIEVED", label: "Achieved", tone: "accent" },
  { health: "NO_DATA", label: "No data", tone: "neutral" },
  { health: "CANCELLED", label: "Cancelled", tone: "neutral" },
];

/** Health distribution for a stacked bar; empty categories are dropped so the legend stays short. */
export function healthSegments(goals: Goal[]) {
  return HEALTH_SEGMENTS
    .map(({ health, label, tone }) => ({ id: health, label, tone, value: goals.filter((goal) => goal.health === health).length }))
    .filter((segment) => segment.value > 0);
}

const TASK_SEGMENTS: { status: TaskStatus; label: string; tone: "good" | "warning" | "danger" | "accent" | "neutral" }[] = [
  { status: "DONE", label: "Done", tone: "good" },
  { status: "IN_PROGRESS", label: "In progress", tone: "accent" },
  { status: "TODO", label: "To do", tone: "neutral" },
  { status: "BLOCKED", label: "Blocked", tone: "danger" },
];

export function taskSegments(tasks: TaskSummary[]) {
  return TASK_SEGMENTS
    .map(({ status, label, tone }) => ({ id: status, label, tone, value: tasks.filter((task) => task.status === status).length }))
    .filter((segment) => segment.value > 0);
}

/** Labels weekly buckets ("Sep 7") in UTC, matching the chart kit's date handling. */
export function weekLabel(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function throughputCategories(weekly: ThroughputResponse["weekly"]) {
  return { categories: weekly.map((week) => weekLabel(week.week_start)), values: weekly.map((week) => week.completed) };
}

const epochOfDay = (iso: string) => {
  const day = parseDay(iso);
  return Date.UTC(day.getFullYear(), day.getMonth(), day.getDate());
};

export interface LineSeriesInput { id: string; label: string; points: { x: number; y: number | null }[]; dashed?: boolean }

/**
 * Metric goals: actual values from check-ins (oldest first, starting from the start value) against
 * a straight ideal pace from start to target over the goal window.
 */
export function metricSeries(goal: Goal, checkins: GoalCheckin[]): LineSeriesInput[] {
  const actual = [...checkins]
    .filter((checkin) => checkin.value !== null)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((checkin) => ({ x: Date.parse(checkin.created_at), y: checkin.value }));
  const start = goal.startValue !== null ? [{ x: epochOfDay(goal.startDate), y: goal.startValue }] : [];
  const series: LineSeriesInput[] = [{ id: "actual", label: "Actual", points: [...start, ...actual] }];
  if (goal.startValue !== null && goal.targetValue !== null) {
    series.push({
      id: "ideal",
      label: "Ideal pace",
      dashed: true,
      points: [
        { x: epochOfDay(goal.startDate), y: goal.startValue },
        { x: epochOfDay(goal.dueDate), y: goal.targetValue },
      ],
    });
  }
  return series;
}

/** Child goals as ranked bars; the value is progress as a ratio, or null when there is no data. */
export function childBars(children: Goal[]) {
  return children.map((child) => ({ id: child.id, label: child.title, value: child.progress }));
}
