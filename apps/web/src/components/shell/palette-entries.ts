import type { ConversationDto } from "@kiro/shared";
import type { ThemePreference } from "@/lib/theme";
import { VIEW_CHORDS, VIEW_LABELS, WORKSPACE_VIEWS, type WorkspaceView } from "./nav";
import type { PaletteEntry } from "./palette-model";

export interface PaletteHandlers {
  navigate: (view: WorkspaceView) => void;
  newQuestion: () => void;
  newGoal: () => void;
  openConversation: (id: string) => void;
  toggleTheme: () => void;
  setTheme: (value: ThemePreference) => void;
  openShortcuts: () => void;
  toggleSidebar: () => void;
}

// Everything the palette can run. The Ask entry is created by the palette itself from the typed text.
export function buildPaletteEntries(conversations: ConversationDto[], handlers: PaletteHandlers): PaletteEntry[] {
  const views: PaletteEntry[] = WORKSPACE_VIEWS.map((view: WorkspaceView) => ({
    id: `view-${view}`,
    group: "Navigate",
    label: `Go to ${VIEW_LABELS[view]}`,
    keywords: view === "organization" ? "dashboards connections integrations company" : view === "work" ? "projects tasks" : undefined,
    shortcut: VIEW_CHORDS[view],
    run: () => handlers.navigate(view),
  }));
  const actions: PaletteEntry[] = [
    { id: "new-question", group: "Create", label: "New question", keywords: "chat ask conversation", run: handlers.newQuestion },
    { id: "new-goal", group: "Create", label: "New goal", keywords: "objective target okr", run: handlers.newGoal },
    { id: "theme-toggle", group: "Preferences", label: "Toggle dark theme", keywords: "light dark appearance theme", run: handlers.toggleTheme },
    { id: "theme-system", group: "Preferences", label: "Use system theme", keywords: "appearance os", run: () => handlers.setTheme("system") },
    { id: "sidebar", group: "Preferences", label: "Collapse or expand sidebar", keywords: "navigation panel", run: handlers.toggleSidebar },
    { id: "shortcuts", group: "Preferences", label: "Keyboard shortcuts", keywords: "help keys chords", shortcut: "?", run: handlers.openShortcuts },
  ];
  const recent: PaletteEntry[] = conversations.slice(0, 8).map((conversation) => ({
    id: `conversation-${conversation.id}`,
    group: "Conversations",
    label: conversation.title ?? "Untitled question",
    run: () => handlers.openConversation(conversation.id),
  }));
  return [...views, ...actions, ...recent];
}
