"use client";
import { useEffect, useRef } from "react";
import { isEditableTarget } from "@/components/shell/nav";
import { moveIndex } from "@/lib/work-metrics";

type Options = { moveRows?: boolean; onCreate?: () => void; onEscape?: () => void };

// Work screen keys: j/k move through the rows of a [data-nav-scope] list or board, c creates a task,
// Escape closes the task panel. Enter opens a focused row because rows are native buttons.
// Ignored while typing, with a modifier held, or while a native dialog is open.
export function useWorkShortcuts({ moveRows = false, onCreate, onEscape }: Options) {
  const handlers = useRef({ onCreate, onEscape });
  handlers.current = { onCreate, onEscape };

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target) || document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        handlers.current.onEscape?.();
        return;
      }
      if (event.key === "c" && handlers.current.onCreate) {
        event.preventDefault();
        handlers.current.onCreate();
        return;
      }
      if (moveRows && (event.key === "j" || event.key === "k")) {
        const scopes = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-scope]")).filter((el) => el.getClientRects().length > 0);
        const active = document.activeElement as HTMLElement | null;
        const scope = scopes.find((el) => active !== null && el.contains(active)) ?? scopes.find((el) => el.dataset.navScope === "tasks") ?? scopes[0];
        if (!scope) return;
        const rows = Array.from(scope.querySelectorAll<HTMLElement>("[data-nav-row]"));
        const next = rows[moveIndex(rows.findIndex((row) => row === active), rows.length, event.key === "j" ? 1 : -1)];
        if (!next) return;
        event.preventDefault();
        next.focus();
        next.scrollIntoView({ block: "nearest" });
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [moveRows]);
}
