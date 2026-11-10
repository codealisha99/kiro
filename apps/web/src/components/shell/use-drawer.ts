"use client";

import { useEffect, useRef, type RefObject } from "react";

// Mobile navigation drawer: focus moves inside, Tab stays contained, Escape closes, focus returns on close.
export function useDrawer(open: boolean, panelRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled)")).filter(
        (element) => element.getClientRects().length > 0,
      );
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      // A native modal owns focus until it closes.
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const media = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => {
      if (media.matches) closeRef.current();
    };
    media.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", handleKey);
    return () => {
      media.removeEventListener("change", closeOnDesktop);
      document.removeEventListener("keydown", handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [open, panelRef]);
}
