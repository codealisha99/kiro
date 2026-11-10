"use client";

import { groupGoalsByScope } from "@/lib/goal-format";
import { matchesFilter, treeRows, type GoalFilter, type GoalListMode } from "@/lib/goal-view";
import type { Goal } from "@/lib/home-api";
import { GoalRow } from "./GoalRow";

export interface GoalListProps {
  goals: Goal[];
  filter: GoalFilter;
  mode: GoalListMode;
  collapsed: ReadonlySet<string>;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}

/** Scope-grouped list, or the alignment tree with collapsible branches. */
export function GoalList({ goals, filter, mode, collapsed, selectedId, onOpen, onToggle }: GoalListProps) {
  if (mode === "tree") {
    const rows = treeRows(goals, filter, collapsed);
    return (
      <ul className="goal-list is-tree" aria-label="Alignment tree">
        {rows.map((row) => (
          <GoalRow
            key={row.goal.id}
            goal={row.goal}
            depth={row.depth}
            context={row.context}
            selected={row.goal.id === selectedId}
            expandable={row.hasChildren ? { expanded: row.expanded, onToggle: () => onToggle(row.goal.id) } : null}
            onOpen={() => onOpen(row.goal.id)}
          />
        ))}
      </ul>
    );
  }

  const titles = new Map(goals.map((goal) => [goal.id, goal.title]));
  const groups = groupGoalsByScope(goals.filter((goal) => matchesFilter(goal, filter)));
  return (
    <div className="goal-groups">
      {groups.map((group) => (
        <section key={group.scope} className="goal-group" aria-labelledby={`goal-group-${group.scope}`}>
          <h3 id={`goal-group-${group.scope}`}>{group.title} <span className="goal-group-count">{group.goals.length}</span></h3>
          <ul className="goal-list">
            {group.goals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                parentTitle={goal.parentId ? titles.get(goal.parentId) ?? null : null}
                selected={goal.id === selectedId}
                onOpen={() => onOpen(goal.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
