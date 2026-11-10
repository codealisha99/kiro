// First-run setup for a workspace administrator. Every step is checked against real records,
// so a step is only "done" when the workspace actually has the thing.

export type SetupFacts = {
  documents: number;
  readyConnections: number;
  teams: number;
  people: number;
  reportingLines: number;
  roleBindings: number;
  goals: number;
};

export type SetupStep = {
  id: "knowledge" | "connect" | "teams" | "people" | "scope" | "goal";
  title: string;
  text: string;
  done: boolean;
  action: { label: string; view: string; tab?: string };
};

export function setupSteps(f: SetupFacts): SetupStep[] {
  return [
    {
      id: "knowledge",
      title: "Add your company's knowledge",
      text: "Upload a handbook, a process guide or project notes. Answers cite what you add.",
      done: f.documents > 0,
      action: { label: "Add a document", view: "library" },
    },
    {
      id: "connect",
      title: "Connect a tool your team uses",
      text: "Slack, Linear, GitHub, Google Drive and more. Kiro reads only what each connection allows.",
      done: f.readyConnections > 0,
      action: { label: "Connect a tool", view: "organization", tab: "connections" },
    },
    {
      id: "teams",
      title: "Add departments and teams",
      text: "Teams group people and the goals they share.",
      done: f.teams > 0,
      action: { label: "Add teams", view: "organization", tab: "setup" },
    },
    {
      id: "people",
      title: "Invite your team",
      text: "Invite colleagues by email. They see only what their place in the organization allows.",
      done: f.people > 1,
      action: { label: "Invite people", view: "organization", tab: "setup" },
    },
    {
      id: "scope",
      title: "Set reporting lines and roles",
      text: "This decides each person's view: managers see their reports, a company role sees everything.",
      done: f.reportingLines > 0 && f.roleBindings > 0,
      action: { label: "Set reporting lines", view: "organization", tab: "setup" },
    },
    {
      id: "goal",
      title: "Set your first company goal",
      text: "Track progress against where it should be today, and see who it depends on.",
      done: f.goals > 0,
      action: { label: "Create a goal", view: "goals" },
    },
  ];
}

export function setupProgress(steps: readonly SetupStep[]) {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, complete: done === steps.length, next: steps.find((s) => !s.done) ?? null };
}

/** People who count toward "Invite your team". Loading the sample documents adds a demo viewer
 *  (viewer@<slug>.demo, UserService.ensureDemoViewer); it is not a colleague, so it is left out. */
export function realPeople(users: readonly { email?: unknown }[]): number {
  return users.filter((u) => !String(u.email ?? "").toLowerCase().endsWith(".demo")).length;
}
