"use client";
import { Badge, Button, Section } from "@/components/ui";
import type { WorkInsight } from "@/lib/work-api";
import { INSIGHT_LABELS, INSIGHT_RECOMMENDATIONS } from "./insight-copy";

// Insights for this project from the workspace insight page. Older pages are in the workspace insight center.
export function ProjectInsights({ insights, onInspect }: { insights: WorkInsight[]; onInspect: (insight: WorkInsight) => void }) {
  return (
    <Section title="Insights" description="Rule-based observations from recorded tasks. Suggestions require human judgment. This tab shows the insights on the loaded page; the workspace insight center lists the rest.">
      {!insights.length && <p>No detected risks in this project on the loaded page. This does not establish that all work is on track.</p>}
      <ul className="work-plain-list">
        {insights.map((i) => (
          <li key={i.id}>
            <Badge tone={i.resolved_at ? "success" : "warning"}>{i.resolved_at ? "Resolved" : INSIGHT_LABELS[i.rule]}</Badge>
            {!i.resolved_at && i.triage_status !== "OPEN" && <Badge>{i.triage_status === "ACKNOWLEDGED" ? "Acknowledged" : "Dismissed"}</Badge>}
            <h4>{i.title}</h4>
            <p>{INSIGHT_RECOMMENDATIONS[i.rule]}</p>
            <Button variant="secondary" onClick={() => onInspect(i)}>Inspect evidence</Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
