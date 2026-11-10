"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { WorkspaceIcon } from "@/components/WorkspaceIcon";

// Breadcrumbs, the ⌘K trigger, and the mobile navigation button.
export function TopBar({
  crumbs,
  navExpanded,
  onOpenNavigation,
  onOpenPalette,
}: {
  crumbs: string[];
  navExpanded: boolean;
  onOpenNavigation: () => void;
  onOpenPalette: () => void;
}) {
  const [shortcut, setShortcut] = useState("⌘K");
  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("Ctrl K");
  }, []);
  return (
    <header className="workspace-header shell-topbar">
      <div className="shell-topbar-start">
        <Button
          variant="secondary"
          className="workspace-mobile icon-button"
          aria-label="Open navigation"
          aria-expanded={navExpanded}
          aria-controls="workspace-navigation"
          onClick={onOpenNavigation}
        >
          <WorkspaceIcon name="menu" />
        </Button>
        <nav aria-label="Breadcrumb" className="shell-crumbs">
          <ol>
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;
              return (
                <li key={`${index}-${crumb}`}>
                  {index > 0 && <span className="shell-crumb-sep" aria-hidden="true">/</span>}
                  <span aria-current={last ? "page" : undefined}>{crumb}</span>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
      <button
        type="button"
        className="shell-palette-trigger"
        onClick={onOpenPalette}
        aria-keyshortcuts="Meta+K Control+K"
        aria-label={`Search and commands, ${shortcut}`}
      >
        <WorkspaceIcon name="search" width="16" height="16" />
        <span>Search or jump to…</span>
        <kbd aria-hidden="true">{shortcut}</kbd>
      </button>
    </header>
  );
}
