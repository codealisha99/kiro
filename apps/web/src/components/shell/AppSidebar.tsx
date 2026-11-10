"use client";

import { useMemo, useState, type RefObject } from "react";
import type { ConversationDto, UserDto } from "@kiro/shared";
import { Button, Input } from "@/components/ui";
import { WorkspaceIcon, type IconName } from "@/components/WorkspaceIcon";
import type { ThemePreference } from "@/lib/theme";
import { VIEW_CHORDS, VIEW_LABELS, type WorkspaceView } from "./nav";
import { WorkspaceMenu } from "./WorkspaceMenu";

interface NavEntry {
  view: WorkspaceView;
  icon: IconName;
}

const PRIMARY: NavEntry[] = [
  { view: "home", icon: "home" },
  { view: "ask", icon: "message" },
  { view: "library", icon: "book" },
];
const WORK: NavEntry[] = [
  { view: "work", icon: "folder" },
  { view: "goals", icon: "target" },
];
const ORGANIZATION: NavEntry[] = [{ view: "organization", icon: "dashboard" }];

export interface AppSidebarProps {
  view: WorkspaceView;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: (view: WorkspaceView) => void;
  onNewQuestion: () => void;
  onAddDocument: () => void;
  busy: boolean;
  documentCount: number;
  showSetup: boolean;
  conversations: ConversationDto[];
  activeConversationId: string | null;
  onOpenConversation: (id: string) => void;
  user: UserDto;
  preference: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
  onProfile: () => void;
  onSignOut: () => void;
  asideRef: RefObject<HTMLElement | null>;
}

// Linear-style navigation: workspace menu, primary views, grouped work and organization, then recents.
export function AppSidebar(props: AppSidebarProps) {
  const { view, collapsed, onNavigate, busy, conversations, activeConversationId } = props;
  const [search, setSearch] = useState("");
  const matching = useMemo(
    () =>
      conversations.filter((conversation) =>
        (conversation.title ?? "Untitled question").toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [conversations, search],
  );

  const renderEntry = (entry: NavEntry) => {
    const label = VIEW_LABELS[entry.view];
    const selected = view === entry.view;
    const count = entry.view === "library" ? props.documentCount : 0;
    return (
      <button
        key={entry.view}
        type="button"
        className={`nav-item${selected ? " selected" : ""}`}
        aria-current={selected ? "page" : undefined}
        title={`${label} · ${VIEW_CHORDS[entry.view]}`}
        onClick={() => onNavigate(entry.view)}
      >
        <WorkspaceIcon name={entry.icon} />
        <span className="nav-label">{label}</span>
        {count > 0 && <span className="nav-count">{count}</span>}
        <kbd className="nav-chord" aria-hidden="true">{VIEW_CHORDS[entry.view]}</kbd>
      </button>
    );
  };

  return (
    <aside className="workspace-sidebar shell-sidebar" ref={props.asideRef} id="workspace-navigation" aria-label="Workspace navigation">
      <div className="shell-sidebar-top">
        <WorkspaceMenu
          user={props.user}
          preference={props.preference}
          onThemeChange={props.onThemeChange}
          onProfile={props.onProfile}
          onSignOut={props.onSignOut}
        />
        <Button
          variant="secondary"
          className="shell-collapse icon-button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls="workspace-navigation"
          onClick={props.onToggleCollapsed}
        >
          <WorkspaceIcon name="sidebar" />
        </Button>
      </div>
      <Button variant="secondary" className="new-question" onClick={props.onNewQuestion} disabled={busy} title="New question">
        <WorkspaceIcon name="plus" />
        <span className="nav-label">New question</span>
      </Button>
      <nav className="workspace-nav" aria-label="Main">
        {PRIMARY.map(renderEntry)}
      </nav>
      <div className="shell-section">
        <p className="shell-section-title">Work</p>
        <nav className="workspace-nav" aria-label="Work">{WORK.map(renderEntry)}</nav>
      </div>
      <div className="shell-section">
        <p className="shell-section-title">Organization</p>
        <nav className="workspace-nav" aria-label="Organization">{ORGANIZATION.map(renderEntry)}</nav>
      </div>
      <div className="workspace-recents">
        <h2 className="shell-section-title">Recent conversations</h2>
        {conversations.length > 0 && (
          <div className="conversation-search">
            <Input type="search" aria-label="Search conversations" placeholder="Find a conversation…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        )}
        {conversations.length > 0 && matching.length === 0 && <p role="status">No matching conversations. Try another search.</p>}
        {conversations.length === 0 ? (
          <p>A little clarity starts with a question.</p>
        ) : (
          matching.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={conversation.id === activeConversationId && view === "ask" ? "active" : ""}
              onClick={() => props.onOpenConversation(conversation.id)}
              disabled={busy}
              title={conversation.title ?? "Untitled question"}
            >
              <WorkspaceIcon name="message" />
              <span>{conversation.title ?? "Untitled question"}</span>
            </button>
          ))
        )}
      </div>
      {props.showSetup && (
        <button className="sidebar-setup" type="button" onClick={props.onAddDocument}>
          <WorkspaceIcon name="upload" />
          <span>
            <strong>Make this desk yours</strong>
            <small>Add your first document</small>
          </span>
          <WorkspaceIcon name="chevron" />
        </button>
      )}
    </aside>
  );
}
