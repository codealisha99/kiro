// Workspace views, their URLs, and keyboard chords. Pure so the shell and the tests share one source.
export const WORKSPACE_VIEWS = ["home", "ask", "library", "goals", "work", "organization"] as const;
export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number];

export const VIEW_LABELS: Record<WorkspaceView, string> = {
  home: "Home",
  ask: "Ask Kiro",
  library: "Library",
  goals: "Goals",
  work: "Projects & tasks",
  organization: "Company dashboards",
};

// Linear-style chords: press g, then the letter.
export const VIEW_CHORDS: Record<WorkspaceView, string> = {
  home: "g h",
  ask: "g a",
  library: "g l",
  goals: "g g",
  work: "g w",
  organization: "g o",
};

const CHORD_KEYS: Record<string, WorkspaceView> = {
  h: "home",
  a: "ask",
  l: "library",
  g: "goals",
  w: "work",
  o: "organization",
};

export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return typeof value === "string" && (WORKSPACE_VIEWS as readonly string[]).includes(value);
}

export function resolveChord(key: string): WorkspaceView | null {
  return CHORD_KEYS[key.toLowerCase()] ?? null;
}

/** Integrations whose OAuth callback returns to the app with ?integration=<provider>. */
export const OAUTH_INTEGRATIONS = ["xero", "googleanalytics", "googledrive"] as const;

export function isOAuthReturn(search: string): boolean {
  const provider = new URLSearchParams(search).get("integration");
  return (OAUTH_INTEGRATIONS as readonly string[]).includes(provider ?? "");
}

// An integration OAuth redirect opens company dashboards, where connected applications live.
export function viewFromSearch(search: string): WorkspaceView | null {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  if (isWorkspaceView(view)) return view;
  if (isOAuthReturn(search)) return "organization";
  return null;
}

// Keeps other parameters (mode, integration) intact when the view changes.
export function searchForView(search: string, view: WorkspaceView): string {
  const params = new URLSearchParams(search);
  params.set("view", view);
  return `?${params.toString()}`;
}

// Shortcuts never fire while the user types in a field.
export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!element) return false;
  return element.isContentEditable === true || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName ?? "");
}
