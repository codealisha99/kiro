"use client";

import { Dialog } from "@/components/ui";
import { VIEW_CHORDS, VIEW_LABELS, WORKSPACE_VIEWS } from "./nav";

// Lists every shortcut so the chords are discoverable. Opens with "?".
export function KeyboardHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" className="shortcut-dialog">
      <div className="shortcut-groups">
        <section>
          <h3>Anywhere</h3>
          <dl className="shortcut-list">
            <div><dt><kbd>⌘</kbd> <kbd>K</kbd></dt><dd>Search, jump to a view, or ask Kiro</dd></div>
            <div><dt><kbd>?</kbd></dt><dd>Show these shortcuts</dd></div>
          </dl>
        </section>
        <section>
          <h3>Go to</h3>
          <dl className="shortcut-list">
            {WORKSPACE_VIEWS.map((view) => (
              <div key={view}>
                <dt>{VIEW_CHORDS[view].split(" ").map((key, index) => <kbd key={`${index}-${key}`}>{key}</kbd>)}</dt>
                <dd>{VIEW_LABELS[view]}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <p className="shortcut-note">Shortcuts pause while you type in a field.</p>
    </Dialog>
  );
}
