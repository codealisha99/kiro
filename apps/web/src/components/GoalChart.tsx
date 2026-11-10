"use client";

import { formatNumber, formatPercent, HBarChart, LineChart, StackedBar } from "@/components/charts";
import type { GoalDetail } from "@/lib/home-api";
import { childBars, metricSeries, taskSegments } from "@/lib/goal-view";

/** The chart follows the measure: a metric trend, a task status split, or the aligned children. */
export function GoalChart({ goal }: { goal: GoalDetail }) {
  if (goal.measure === "METRIC") {
    const unit = goal.unit ? ` ${goal.unit}` : "";
    return (
      <LineChart
        title="Progress over time"
        description="Check-in values against a straight ideal pace from the start value to the target."
        series={metricSeries(goal, goal.checkins)}
        valueFormat={(value) => `${formatNumber(value)}${unit}`}
        emptyText="Add a check-in to draw progress against the ideal pace."
        height={220}
      />
    );
  }
  if (goal.measure === "TASKS") {
    return (
      <StackedBar
        title="Linked task status"
        description="Counts of readable tasks linked to this goal."
        segments={taskSegments(goal.tasks)}
        emptyText="No readable tasks are linked to this goal yet."
      />
    );
  }
  return (
    <HBarChart
      title="Aligned goals"
      description="Progress of each visible goal aligned to this one."
      items={childBars(goal.children)}
      valueFormat={(ratio) => formatPercent(ratio)}
      emptyText="No visible goals are aligned to this goal yet."
    />
  );
}
