import type { WorkInsight } from "@/lib/work-api";

export const INSIGHT_LABELS: Record<WorkInsight["rule"], string> = {
  OVERDUE: "Overdue commitment",
  BLOCKED: "Recorded blocker",
  UNASSIGNED: "Ownership gap",
};

export const INSIGHT_RECOMMENDATIONS: Record<WorkInsight["rule"], string> = {
  OVERDUE: "Review the due date and agree on a recovery plan.",
  BLOCKED: "Confirm the blocker and identify who can resolve it.",
  UNASSIGNED: "Agree on an owner with project access.",
};
