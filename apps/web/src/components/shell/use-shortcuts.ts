"use client";

import { useEffect, useRef } from "react";
import { isEditableTarget, resolveChord, type WorkspaceView } from "./nav";

const CHORD_WINDOW_MS = 1200;

// Linear-style single-key shortcuts: "g" then a letter navigates, "?" opens the help dialog.
// Ignored while typing, while a modifier is held, and while a native dialog is open.
export function useShortcuts({
  enabled,
  onNavigate,
  onOpenHelp,
}: {
  enabled: boolean;
  onNavigate: (view: WorkspaceView) => void;
  onOpenHelp: () => void;
}) {
  const handlers = useRef({ onNavigate, onOpenHelp });
  handlers.current = { onNavigate, onOpenHelp };

  useEffect(() => {
    if (!enabled) return;
    let pendingChord = false;
    let timer: number | undefined;
    const clearChord = () => {
      pendingChord = false;
      window.clearTimeout(timer);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target) || document.querySelector("dialog[open]")) {
        clearChord();
        return;
      }
      if (pendingChord) {
        const view = resolveChord(event.key);
        clearChord();
        if (view) {
          event.preventDefault();
          handlers.current.onNavigate(view);
        }
        return;
      }
      if (event.key === "g") {
        pendingChord = true;
        timer = window.setTimeout(clearChord, CHORD_WINDOW_MS);
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        handlers.current.onOpenHelp();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      clearChord();
      document.removeEventListener("keydown", handleKey);
    };
  }, [enabled]);
}
