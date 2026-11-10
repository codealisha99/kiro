"use client";

import { useState } from "react";
import type { UserDto } from "@kiro/shared";
import { Button, PageHeader, PageTabs, Panel, Section } from "@/components/ui";
import { WorkspaceIcon } from "@/components/WorkspaceIcon";
import { TopBar } from "@/components/shell/TopBar";
import { WorkspaceMenu } from "@/components/shell/WorkspaceMenu";
import { VIEW_CHORDS, VIEW_LABELS } from "@/components/shell/nav";

const sampleUser: UserDto = {
  id: "sample",
  tenantId: "sample",
  email: "morgan@example.com",
  name: "Morgan Ruiz",
  role: "manager",
};

const tabItems = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity", count: 12 },
  { id: "method", label: "Method" },
] as const;

// Shell pieces rendered with sample data. The real shell is composed in components/Workspace.tsx.
export function ShellSection() {
  const [tab, setTab] = useState<(typeof tabItems)[number]["id"]>("overview");
  return (
    <div className="shell-sample">
      <div className="shell-sample-frame">
        <div className="shell-sample-sidebar">
          <div className="shell-sidebar-top">
            <WorkspaceMenu
              user={sampleUser}
              preference="light"
              onThemeChange={() => undefined}
              onProfile={() => undefined}
              onSignOut={() => undefined}
            />
          </div>
          <nav className="workspace-nav" aria-label="Sample navigation">
            {(["home", "ask", "library", "goals"] as const).map((view, index) => (
              <button key={view} type="button" className={`nav-item${index === 0 ? " selected" : ""}`} aria-current={index === 0 ? "page" : undefined}>
                <WorkspaceIcon name={view === "home" ? "home" : view === "ask" ? "message" : view === "library" ? "book" : "target"} />
                <span className="nav-label">{VIEW_LABELS[view]}</span>
                <kbd className="nav-chord" aria-hidden="true">{VIEW_CHORDS[view]}</kbd>
              </button>
            ))}
          </nav>
        </div>
        <div className="shell-sample-main">
          <TopBar crumbs={["Workspace", "Goals"]} navExpanded={false} onOpenNavigation={() => undefined} onOpenPalette={() => undefined} />
          <div className="shell-sample-content">
            <PageHeader
              eyebrow="Planning"
              title="Goals"
              subtitle="Targets for the company, teams, and people, with expected progress for today."
              meta={<><span>12 goals</span><span>3 at risk</span></>}
              actions={<><Button variant="secondary">Export</Button><Button variant="primary"><WorkspaceIcon name="plus" />New goal</Button></>}
              tabs={<PageTabs items={[...tabItems]} value={tab} onChange={setTab} label="Goal views" />}
            />
            <Section title="Health" description="Counts come from the goals you can see.">
              <Panel tone="raised">
                <p className="shell-sample-note">Section body. Panels group related data; raised panels sit one step lighter.</p>
              </Panel>
            </Section>
          </div>
        </div>
      </div>
      <div className="shell-sample-palette-wrap">
        <p className="section-label">Command palette · anatomy</p>
        <div className="palette palette-sample" role="presentation">
          <div className="palette-input-row">
            <WorkspaceIcon name="search" />
            <span className="shell-sample-input">Goal</span>
            <kbd>Esc</kbd>
          </div>
          <ul className="palette-list" aria-label="Sample commands">
            <li className="palette-option is-active"><span className="palette-option-label">Go to Goals</span><span className="palette-option-meta"><span>Navigate</span><kbd>g g</kbd></span></li>
            <li className="palette-option"><span className="palette-option-label">New goal</span><span className="palette-option-meta"><span>Create</span></span></li>
            <li className="palette-option"><span className="palette-option-label">Ask Kiro: goal</span><span className="palette-option-meta"><span>Ask</span></span></li>
          </ul>
          <p className="palette-hint"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>↵</kbd> to run · <kbd>Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  );
}
