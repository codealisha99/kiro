// Moves the workspace to another view without a reload. The workspace listens for popstate,
// so dispatching it after pushState keeps the URL and the view in step.
export function openView(view: string, extra: Record<string, string | null> = {}) {
  const params = new URLSearchParams(window.location.search);
  params.set("view", view);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  window.history.pushState(null, "", `${window.location.pathname}?${params.toString()}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function openGoalsView(goalId?: string) {
  openView("goals", { goal: goalId ?? null });
}

/** Selection is kept in the URL (replaceState) so a selected goal survives a refresh and can be linked. */
export function setSelectedGoalParam(goalId: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (goalId) params.set("goal", goalId);
  else params.delete("goal");
  const query = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

export function selectedGoalParam(): string | null {
  return new URLSearchParams(window.location.search).get("goal");
}
