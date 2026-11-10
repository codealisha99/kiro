"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { UserDto } from "@kiro/shared";
import { KiroMark, WorkspaceIcon } from "@/components/WorkspaceIcon";
import { THEME_PREFERENCES, type ThemePreference } from "@/lib/theme";

const THEME_LABELS: Record<ThemePreference, string> = { light: "Light", dark: "Dark", system: "System" };

// Workspace header menu: profile, theme, and sign out. Arrow keys move, Escape closes and restores focus.
export function WorkspaceMenu({
  user,
  preference,
  onThemeChange,
  onProfile,
  onSignOut,
}: {
  user: UserDto;
  preference: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
  onProfile: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const name = user.name?.trim() || user.email.split("@")[0];
  const workspace = user.tenantName?.trim() || "Workspace";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) wrapRef.current?.querySelector<HTMLElement>("[role^='menuitem']")?.focus();
  }, [open]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role^='menuitem']"));
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length];
    next?.focus();
  }

  return (
    <div className="ws-menu" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="ws-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ws-mark" aria-hidden="true">
          <KiroMark />
        </span>
        <span className="ws-menu-name">
          <strong>{workspace}</strong>
          <small>{name}</small>
        </span>
        <WorkspaceIcon name="chevronsUpDown" width="16" height="16" />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Workspace menu" className="ws-menu-popover" onKeyDown={onMenuKeyDown}>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onProfile(); }}>
            <WorkspaceIcon name="user" />
            Your profile
          </button>
          <div className="ws-menu-divider" aria-hidden="true" />
          <p className="ws-menu-heading" id={`${menuId}-theme`}>Theme</p>
          <div role="group" aria-labelledby={`${menuId}-theme`} className="ws-menu-themes">
            {THEME_PREFERENCES.map((value) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={preference === value}
                onClick={() => onThemeChange(value)}
              >
                <WorkspaceIcon name={value === "light" ? "sun" : value === "dark" ? "moon" : "computer"} />
                {THEME_LABELS[value]}
                {preference === value && <WorkspaceIcon name="check" className="ws-menu-check" />}
              </button>
            ))}
          </div>
          <div className="ws-menu-divider" aria-hidden="true" />
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onSignOut(); }}>
            <WorkspaceIcon name="logout" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

