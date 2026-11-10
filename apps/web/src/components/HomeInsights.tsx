import { Alert } from "@/components/ui";
import { BarChart, StackedBar } from "@/components/charts";
import type { Goal, ThroughputResponse } from "@/lib/home-api";
import { healthSegments, throughputCategories } from "@/lib/goal-view";

export function HomeThroughput({ throughput, error }: { throughput: ThroughputResponse | null; error: string | null }) {
  if (error && !throughput) return <Alert tone="warning">The weekly chart is unavailable. {error}</Alert>;
  const { categories, values } = throughputCategories(throughput?.weekly ?? []);
  return (
    <BarChart
      title="Completed per week"
      description="Tasks finished in each ISO week you can see, oldest first."
      categories={categories}
      series={[{ id: "completed", label: "Completed", values }]}
      loading={!throughput}
      emptyText="No completed tasks in the last 8 weeks."
      height={200}
    />
  );
}

export function HomeHealth({ goals }: { goals: Goal[] }) {
  return (
    <StackedBar
      title="Goal health"
      description="Visible goals by health label."
      segments={healthSegments(goals)}
      emptyText="No goals to show yet."
    />
  );
}
