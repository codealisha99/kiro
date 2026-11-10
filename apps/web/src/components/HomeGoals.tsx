"use client";

import { Button, Card } from "@/components/ui";
import type { Goal } from "@/lib/home-api";
import { openGoalsView } from "@/lib/goal-nav";
import { prioritizedGoals } from "@/lib/goal-view";
import { GoalRow } from "./GoalRow";

const PREVIEW_GOALS = 5;

export function HomeGoals({ goals }: { goals: Goal[] }) {
  const titles = new Map(goals.map((goal) => [goal.id, goal.title]));
  const preview = prioritizedGoals(goals).slice(0, PREVIEW_GOALS);
  return (
    <section className="home-section" aria-labelledby="home-goals-title">
      <div className="home-section-heading">
        <div>
          <h2 id="home-goals-title">Goals</h2>
          <p className="muted">Progress against where each goal should be today. Your goals are listed first.</p>
        </div>
        <Button variant="secondary" size="small" onClick={() => openGoalsView()}>All goals</Button>
      </div>
      {goals.length === 0 ? (
        <Card className="home-empty">
          <p>No goals yet. Goals appear here once someone in your organization sets them.</p>
        </Card>
      ) : (
        <>
          <ul className="goal-list is-compact">
            {preview.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                parentTitle={goal.parentId ? titles.get(goal.parentId) ?? null : null}
                compact
                onOpen={() => openGoalsView(goal.id)}
              />
            ))}
          </ul>
          {goals.length > PREVIEW_GOALS && (
            <p className="muted home-more">Showing {PREVIEW_GOALS} of {goals.length} goals.</p>
          )}
        </>
      )}
    </section>
  );
}
