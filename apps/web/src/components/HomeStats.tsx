import { formatNumber, StatTile } from "@/components/charts";
import type { HomeResponse, ThroughputResponse } from "@/lib/home-api";
import { onTrackRatio } from "@/lib/goal-view";

export function HomeStats({ home, throughput }: { home: HomeResponse; throughput: ThroughputResponse | null }) {
  const metrics = home.scopeSummary.metrics;
  const num = (key: string): number | null => (typeof metrics[key] === "number" ? (metrics[key] as number) : null);
  const tasks = num("tasks");
  const completed = num("completed");
  const open = tasks !== null && completed !== null ? tasks - completed : null;
  const weekly = throughput?.weekly ?? [];
  const completedWeeks = weekly.reduce((sum, week) => sum + week.completed, 0);
  const ratio = onTrackRatio(home.goals);
  const fmt = (value: number | null) => (value === null ? "–" : formatNumber(value));

  return (
    <div className="home-stats" aria-label="Headline numbers">
      <StatTile label="Open tasks" value={fmt(open)} note="Unfinished tasks in this scope." />
      <StatTile
        label="Completed, 8 weeks"
        value={throughput ? formatNumber(completedWeeks) : "–"}
        trend={weekly.map((week) => week.completed)}
        note="Tasks finished per week."
      />
      <StatTile label="Blocked" value={fmt(num("blocked"))} note="Tasks marked blocked." />
      <StatTile label="Overdue" value={fmt(num("overdue"))} note="Unfinished and due before today (UTC)." />
      <StatTile
        label="Goals on track"
        value={ratio.total === 0 ? "–" : `${ratio.onTrack} of ${ratio.total}`}
        note="On track or achieved. Cancelled goals are left out."
      />
    </div>
  );
}
