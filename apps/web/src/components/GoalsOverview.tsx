"use client";

import { BarChart, HBarChart } from "@/components/charts";
import { SCOPE_TITLES } from "@/lib/goal-format";
import type { Goal } from "@/lib/home-api";
import { behindPace, progressByScope } from "@/lib/goal-view";
import { HomeHealth } from "./HomeInsights";

// What a leader asks first on the Goals screen: how healthy are we, which goals are slipping,
// and which level of the organization is behind. All three use the goals this person can see.
export function GoalsOverview({ goals }: { goals: Goal[] }) {
  const levels = progressByScope(goals);
  const behind = behindPace(goals);
  return (
    <div className="goals-overview">
      <HomeHealth goals={goals} />
      <HBarChart
        title="Furthest behind today's pace"
        description="Active goals, in percentage points behind where they should be by today."
        items={behind}
        valueFormat={(v) => `${v} pts`}
        emptyText="No active goal is behind its expected pace."
      />
      <BarChart
        title="Progress against plan, by level"
        description={`Average progress of active goals beside the average expected by today. ${levels.map((l) => `${SCOPE_TITLES[l.scope]}: ${l.count}`).join(", ")}.`}
        categories={levels.map((l) => SCOPE_TITLES[l.scope])}
        series={[
          { id: "progress", label: "Progress", values: levels.map((l) => l.progress) },
          { id: "expected", label: "Expected by today", values: levels.map((l) => l.expected) },
        ]}
        yFormat={(v) => `${v}%`}
        valueFormat={(v) => `${v}%`}
        height={200}
        emptyText="No active goals with measured progress yet."
      />
    </div>
  );
}
