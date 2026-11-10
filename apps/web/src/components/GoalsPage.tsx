"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, PageHeader, PageTabs } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { homeApi, type Goal, type GoalOptions } from "@/lib/home-api";
import { selectedGoalParam, setSelectedGoalParam } from "@/lib/goal-nav";
import { filterCounts, GOAL_FILTER_LABELS, GOAL_FILTERS, visibleGoalOrder, type GoalFilter, type GoalListMode } from "@/lib/goal-view";
import { GoalDialog } from "./GoalDialog";
import { GoalList } from "./GoalList";
import { GoalPanel } from "./GoalPanel";
import "./goals-page.css";

export interface GoalsPageProps {
  /** Increments each time "New goal" is requested from the palette or a shortcut. */
  createRequest?: number;
}

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return "Goals are not available to this account. Ask an administrator for access.";
  return error instanceof Error ? error.message : "Goals could not be loaded.";
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

const rowId = (id: string) => `goal-row-${id}`;

export default function GoalsPage({ createRequest = 0 }: GoalsPageProps) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [options, setOptions] = useState<GoalOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<GoalFilter>("all");
  const [mode, setMode] = useState<GoalListMode>("list");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const run = ++generation.current;
    const [homeResult, optionsResult] = await Promise.allSettled([homeApi.home(), homeApi.goalOptions()]);
    if (run !== generation.current) return;
    if (homeResult.status === "fulfilled") {
      setViewerId(homeResult.value.me.id);
      setGoals(homeResult.value.goals);
      setLoadError(null);
    } else {
      setLoadError(loadErrorMessage(homeResult.reason));
    }
    if (optionsResult.status === "fulfilled") {
      setOptions(optionsResult.value);
      setOptionsError(null);
    } else {
      setOptionsError(loadErrorMessage(optionsResult.reason));
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    const activeGeneration = generation;
    void refresh();
    return () => { activeGeneration.current++; };
  }, [refresh]);

  // Deep links: ?goal=<id> from Home or a shared URL opens that goal's panel.
  useEffect(() => {
    const requested = selectedGoalParam();
    if (requested) {
      setSelectedId(requested);
      setFocusedId(requested);
    }
  }, []);

  // The palette and shortcuts bump createRequest; open the dialog whenever it changes, regardless of mount order.
  useEffect(() => {
    if (createRequest > 0) setCreating(true);
  }, [createRequest]);

  const order = useMemo(() => visibleGoalOrder(goals, filter, mode, collapsed).map((goal) => goal.id), [goals, filter, mode, collapsed]);
  const counts = useMemo(() => filterCounts(goals), [goals]);
  const filterItems = GOAL_FILTERS.map((id) => ({ id, label: GOAL_FILTER_LABELS[id], count: counts[id] }));
  const canCreate = (options?.scopes.length ?? 0) > 0;
  const hasPanel = selectedId !== null;

  const select = useCallback((id: string | null, focus = true) => {
    setSelectedId(id);
    if (id) setFocusedId(id);
    setSelectedGoalParam(id);
    if (id && focus) document.getElementById(rowId(id))?.focus();
  }, []);

  const toggleBranch = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const moveFocus = useCallback((step: 1 | -1) => {
    if (order.length === 0) return;
    const index = order.indexOf(focusedId ?? "");
    const next = index === -1 ? (step === 1 ? 0 : order.length - 1) : (index + step + order.length) % order.length;
    setFocusedId(order[next]);
    document.getElementById(rowId(order[next]))?.focus();
  }, [order, focusedId]);

  // Keyboard model: j/k move, Enter opens (native button activation), Escape closes, c creates.
  // Shortcuts stand down while typing, with a modifier, or while a native dialog is open.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || document.querySelector("dialog[open]")) return;
      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        moveFocus(event.key === "j" ? 1 : -1);
      } else if (event.key === "Enter" && focusedId && event.target === document.body) {
        event.preventDefault();
        select(focusedId);
      } else if (event.key === "Escape" && selectedId) {
        event.preventDefault();
        select(null, false);
        document.getElementById(rowId(selectedId))?.focus();
      } else if (event.key === "c" && canCreate) {
        event.preventDefault();
        setCreating(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [moveFocus, focusedId, selectedId, select, canCreate]);

  function handleCreated(goal: Goal) {
    setCreating(false);
    void refresh();
    select(goal.id);
  }

  const showAll = () => setFilter("all");
  const body = (() => {
    if (!loaded) return <p role="status" className="muted">Loading goals…</p>;
    if (loadError && goals.length === 0) {
      return <Alert tone="danger">{loadError} <Button variant="secondary" size="small" onClick={() => void refresh()}>Try again</Button></Alert>;
    }
    if (goals.length === 0) {
      return (
        <Card className="goals-empty">
          <p>{canCreate ? "No goals yet. Set the first one to start tracking progress against a target." : "No goals yet. Goals appear here once someone in your organization sets them."}</p>
          {canCreate && <Button variant="primary" onClick={() => setCreating(true)}>Create the first goal</Button>}
        </Card>
      );
    }
    if (order.length === 0) {
      return (
        <Card className="goals-empty">
          <p>No goals match this view.</p>
          <Button variant="secondary" onClick={showAll}>Show all goals</Button>
        </Card>
      );
    }
    return (
      <GoalList
        goals={goals}
        filter={filter}
        mode={mode}
        collapsed={collapsed}
        selectedId={selectedId}
        onOpen={(id) => select(id, false)}
        onToggle={toggleBranch}
      />
    );
  })();

  return (
    <div className="shell-page goals-page" data-create-request={createRequest}>
      <PageHeader
        title="Goals"
        subtitle="Targets for the company, departments, teams, and people, measured against where they should be today."
        meta={loaded && goals.length > 0 ? <span>{goals.length} {goals.length === 1 ? "goal" : "goals"} you can see</span> : undefined}
        actions={canCreate ? <Button variant="primary" onClick={() => setCreating(true)}>New goal <kbd className="goals-kbd">c</kbd></Button> : undefined}
        tabs={<PageTabs items={filterItems} value={filter} onChange={setFilter} label="Goal views" />}
      />
      <div className="goals-toolbar">
        <div className="goals-mode" role="group" aria-label="Goal layout">
          <Button variant="secondary" size="small" aria-pressed={mode === "list"} onClick={() => setMode("list")}>List</Button>
          <Button variant="secondary" size="small" aria-pressed={mode === "tree"} onClick={() => setMode("tree")}>Alignment tree</Button>
        </div>
        <p className="goals-shortcuts muted"><kbd>j</kbd> <kbd>k</kbd> move · <kbd>Enter</kbd> open · <kbd>Esc</kbd> close · <kbd>c</kbd> new</p>
      </div>
      {loadError && goals.length > 0 && <Alert tone="warning">{loadError} Showing the last loaded goals.</Alert>}
      <div className={`goals-layout${hasPanel ? " has-panel" : ""}`}>
        <section className="goals-list" aria-label="Goals">{body}</section>
        {selectedId && (
          <GoalPanel
            key={selectedId}
            goalId={selectedId}
            goals={goals}
            onClose={() => select(null, false)}
            onSelect={(id) => select(id)}
            onChanged={() => void refresh()}
          />
        )}
      </div>
      <GoalDialog
        open={creating}
        options={viewerId ? options : null}
        optionsError={optionsError}
        goals={goals}
        viewerId={viewerId ?? ""}
        onClose={() => setCreating(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
