"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { WorkspaceIcon } from "@/components/WorkspaceIcon";
import { askEntryLabel, filterPaletteItems, type PaletteEntry } from "./palette-model";

// Combobox + listbox command palette. Focus stays in the input; arrows move the active option.
export function CommandPalette({
  open,
  entries,
  onClose,
  onAsk,
}: {
  open: boolean;
  entries: PaletteEntry[];
  onClose: () => void;
  onAsk: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const trimmed = query.trim();

  const items = useMemo<PaletteEntry[]>(() => {
    const matches = filterPaletteItems(entries, query);
    if (!trimmed) return matches;
    // Real matches rank first; asking the question is the fallback and sits last.
    const ask: PaletteEntry = {
      id: "ask-query",
      group: "Ask",
      label: askEntryLabel(trimmed),
      run: () => onAsk(trimmed),
    };
    return [...matches, ask];
  }, [entries, query, trimmed, onAsk]);

  const activeIndex = Math.min(active, Math.max(0, items.length - 1));

  // Reset on open, move focus in, and restore focus to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  function runItem(item: PaletteEntry | undefined) {
    if (!item) return;
    onClose();
    item.run();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + delta + items.length) % items.length);
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      runItem(items[activeIndex]);
    } else if (event.key === "Tab") {
      // Focus stays in the palette until it closes.
      event.preventDefault();
    }
  }

  return createPortal(
    <div
      className="palette-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search and commands" onKeyDown={onKeyDown}>
        <div className="palette-input-row">
          <WorkspaceIcon name="search" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={items[activeIndex] ? `${listId}-${items[activeIndex].id}` : undefined}
            aria-label="Search commands and conversations"
            placeholder="Jump to a view, or ask Kiro something…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Commands" className="palette-list">
          {items.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-${item.id}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`palette-option${index === activeIndex ? " is-active" : ""}`}
              onPointerMove={() => setActive(index)}
              onPointerDown={(event) => {
                event.preventDefault();
                runItem(item);
              }}
            >
              <span className="palette-option-label">{item.label}</span>
              <span className="palette-option-meta">
                <span>{item.group}</span>
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
              </span>
            </li>
          ))}
        </ul>
        {items.length === 0 && <p className="palette-empty" role="status">No matching commands. Try a view name or ask a question.</p>}
        <p className="palette-hint" aria-hidden="true">
          <kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>↵</kbd> to run · <kbd>Esc</kbd> to close
        </p>
      </div>
    </div>,
    document.body,
  );
}
