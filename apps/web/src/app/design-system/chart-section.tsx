"use client";

import {
  BarChart,
  HBarChart,
  LineChart,
  ProgressBar,
  Sparkline,
  StackedBar,
  StatTile,
  formatDelta,
  formatNumber,
  type LineSeries,
} from "@/components/charts";

// Sample data only. Values are illustrative, not measurements.
const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 27);
const days = Array.from({ length: 14 }, (_, i) => START + i * DAY);
const completed = [3, 4, 2, 5, 6, 4, 3, 5, 7, 6, 4, 5, 6, 8];
const opened = [5, 4, 6, 3, 4, 5, 6, 4, 5, 4, 6, 5, 4, 3];
const trendSeries: LineSeries[] = [
  { id: "done", label: "Completed", points: days.map((x, i) => ({ x, y: completed[i] })) },
  { id: "opened", label: "Opened", points: days.map((x, i) => ({ x, y: opened[i] })) },
];
const gappedSeries: LineSeries[] = [
  { id: "single", label: "Blocked", points: days.map((x, i) => ({ x, y: i === 6 ? null : (i % 4) + 1 })) },
];

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const planned = [12, 14, 11, 16, 13];
const delivered = [10, 15, 9, 14, 12];

const teams = [
  { id: "checkout", label: "Checkout", value: 42, detail: "Payments" },
  { id: "growth", label: "Growth", value: 37, detail: "Acquisition" },
  { id: "platform", label: "Platform", value: 28, detail: "Infrastructure" },
  { id: "support", label: "Support", value: 19 },
  { id: "finance", label: "Finance", value: 9 },
];

const goalHealth = [
  { id: "on", label: "On track", value: 4, tone: "good" as const },
  { id: "risk", label: "At risk", value: 2, tone: "warning" as const },
  { id: "off", label: "Off track", value: 2, tone: "danger" as const },
  { id: "done", label: "Achieved", value: 1, tone: "accent" as const },
  { id: "none", label: "No data", value: 1, tone: "neutral" as const },
];

// Stat tiles, line and bar charts, rankings, distributions, and progress.
// Each chart carries its own table view. Preview both themes below.
export function ChartGallery() {
  return (
    <div className="chart-gallery">
      <div className="chart-kpi-row">
        <StatTile label="Completed this week" value={formatNumber(42)} delta={{ change: 4, text: formatDelta(4, " vs last week"), good: "up" }} trend={completed} />
        <StatTile label="Blocked tasks" value={formatNumber(1)} delta={{ change: 1, text: formatDelta(1, " vs last week"), good: "down" }} trend={[1, 0, 2, 1, 1, 0, 1]} />
        <StatTile label="Open risks" value={formatNumber(3)} delta={{ change: 0, text: "No change" }} note="Calculated from your scope" />
        <StatTile label="Average cycle" value="3.4 days" delta={{ change: -0.6, text: formatDelta(-0.6, " days"), good: "down" }} trend={[4, 4.2, 3.9, 3.6, 3.5, 3.4]} />
      </div>
      <div className="chart-grid-2">
        <LineChart
          title="Completed and opened per day"
          description="Two series with a daily target. Use the arrow keys to inspect values."
          series={trendSeries}
          target={{ label: "Target", value: 6 }}
          height={240}
          footer="Calculated from task updates in the last 14 days."
        />
        <LineChart title="Blocked, with a gap" description="A missing day stays empty instead of drawing a false line." series={gappedSeries} height={240} />
      </div>
      <div className="chart-grid-2">
        <BarChart title="Planned versus delivered" description="Grouped bars with a tooltip on each bar." categories={weekdays} series={[{ id: "planned", label: "Planned", values: planned }, { id: "delivered", label: "Delivered", values: delivered }]} height={240} />
        <BarChart title="Work by discipline" description="Stacked bars show the total and each part." categories={weekdays} stacked series={[{ id: "eng", label: "Engineering", values: [6, 8, 5, 9, 7] }, { id: "design", label: "Design", values: [3, 3, 2, 4, 2] }, { id: "ops", label: "Operations", values: [3, 3, 4, 3, 4] }]} height={240} />
      </div>
      <div className="chart-grid-2">
        <HBarChart title="Open tasks by team" description="Ranking, one series." items={teams} />
        <div className="chart-stack">
          <StackedBar title="Goal health" description="Every goal you can see, by health label." segments={goalHealth} />
          <div className="chart-progress-list">
            <p className="section-label">Progress against expected by today</p>
            <ProgressBar value={0.52} expected={0.72} label="Revenue goal" valueText="52% complete. Expected 72% by today." />
            <ProgressBar value={0.25} expected={0.72} label="Conversion goal" tone="danger" valueText="25% complete. Expected 72% by today." />
            <ProgressBar value={0.9} expected={0.6} label="Latency goal" tone="good" valueText="90% complete. Expected 60% by today." />
            <div className="chart-spark-row">
              <span>Trend</span>
              <Sparkline values={completed} label="Completed per day" />
            </div>
          </div>
        </div>
      </div>
      <div className="chart-grid-2">
        <LineChart title="Loading state" description="Shown while data loads." series={[]} loading />
        <BarChart title="Empty state" description="Shown when a period has no values." categories={[]} series={[]} />
      </div>
    </div>
  );
}

// The same charts side by side in both themes, independent of the page toggle.
export function ThemeComparison() {
  return (
    <div className="chart-theme-pair">
      {(["light", "dark"] as const).map((theme) => (
        <div key={theme} className="chart-theme-column" data-theme={theme}>
          <p className="section-label">{theme === "light" ? "Light" : "Dark"} theme</p>
          <StatTile label="Completed this week" value="42" delta={{ change: 4, text: "+4 vs last week", good: "up" }} trend={completed} />
          <LineChart title="Completed and opened" series={trendSeries} target={{ label: "Target", value: 6 }} height={200} />
          <StackedBar title="Goal health" segments={goalHealth} />
          <HBarChart title="Open tasks by team" items={teams.slice(0, 3)} />
        </div>
      ))}
    </div>
  );
}
