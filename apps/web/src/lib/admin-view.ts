// View models for the admin console. The audit endpoint returns the newest events first, up to a limit,
// so charts built from it cover "the most recent events", and say so.

export type AuditEvent = {
  id: string;
  userId: string | null;
  action: string;
  resource: string | null;
  query: string | null;
  permissionDecision: string | null;
  error: string | null;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  "query.received": "Asked",
  "query.completed": "Answered",
  "query.failed": "Failed",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

const DAY_MS = 86_400_000;

/** Answered and failed questions per UTC day for the last `days` days, oldest first. */
export function questionsPerDay(events: readonly AuditEvent[], days: number, nowMs: number) {
  const today = Math.floor(nowMs / DAY_MS);
  const index = new Map<number, number>();
  const dayStarts: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    index.set(today - i, dayStarts.length);
    dayStarts.push((today - i) * DAY_MS);
  }
  const answered = dayStarts.map(() => 0);
  const failed = dayStarts.map(() => 0);
  for (const e of events) {
    const slot = index.get(Math.floor(Date.parse(e.createdAt) / DAY_MS));
    if (slot === undefined) continue;
    if (e.action === "query.completed") answered[slot] += 1;
    else if (e.action === "query.failed") failed[slot] += 1;
  }
  return { dayStarts, answered, failed };
}

export function feedbackSegments(feedback: readonly { helpful: boolean; _count: number }[]) {
  const count = (helpful: boolean) => feedback.filter((f) => f.helpful === helpful).reduce((sum, f) => sum + Number(f._count), 0);
  return [
    { id: "helpful", label: "Helpful", value: count(true), tone: "good" as const },
    { id: "not-helpful", label: "Not helpful", value: count(false), tone: "danger" as const },
  ];
}

/** Share of indexed text ready for semantic search, or null when nothing has been indexed. */
export function searchReadiness(chunks: number, embedded: number): number | null {
  return chunks > 0 ? Math.min(1, embedded / chunks) : null;
}

/** "allowed:no_evidence" → "Allowed · no evidence". Unknown shapes pass through readable. */
export function decisionLabel(decision: string | null): string {
  if (!decision) return "Not recorded";
  const [outcome, ...detail] = decision.split(":");
  const words = (s: string) => s.replace(/[_-]+/g, " ").trim();
  const head = words(outcome);
  const label = head.charAt(0).toUpperCase() + head.slice(1);
  return detail.length ? `${label} · ${words(detail.join(":"))}` : label;
}
