"use client";

import { useState } from "react";
import { Alert, Button, Card, Dialog } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { homeApi, type Goal, type GoalOptions } from "@/lib/home-api";
import { emptyGoalValues, toGoalDraft, validateGoalValues, type GoalFormValues } from "@/lib/goal-draft";
import { groupGoalsByScope, toIsoDay } from "@/lib/goal-format";
import { GoalForm } from "./GoalForm";
import { GoalRow } from "./GoalRow";

export interface HomeGoalsProps {
  goals: Goal[];
  viewerId: string;
  options: GoalOptions | null;
  optionsError: string | null;
  onOpenGoal: (id: string) => void;
  onChanged: () => void;
}

function createErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return "You do not have permission to create goals in this scope.";
  return error instanceof Error ? error.message : "The goal could not be saved. Try again.";
}

export function HomeGoals({ goals, viewerId, options, optionsError, onOpenGoal, onChanged }: HomeGoalsProps) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const canCreate = (options?.scopes.length ?? 0) > 0;
  const groups = groupGoalsByScope(goals);
  const titles = new Map(goals.map((goal) => [goal.id, goal.title]));
  const today = toIsoDay(new Date());

  function startCreate() {
    setServerError(null);
    setCreating(true);
  }

  async function create(values: GoalFormValues) {
    if (Object.values(validateGoalValues(values)).some(Boolean)) return;
    setSaving(true); setServerError(null);
    try {
      await homeApi.createGoal(toGoalDraft(values, viewerId));
      setCreating(false);
      onChanged();
    } catch (error) {
      setServerError(createErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="home-section" aria-labelledby="home-goals-title">
      <div className="home-section-heading">
        <div>
          <h2 id="home-goals-title">Goals</h2>
          <p className="muted">Progress against the expected marker for today. Health labels say what the numbers show.</p>
        </div>
        {canCreate && <Button variant="secondary" onClick={startCreate}>New goal</Button>}
      </div>
      {optionsError && <Alert tone="warning">Goal creation is unavailable right now. {optionsError}</Alert>}
      {groups.length === 0 ? (
        <Card className="home-empty">
          <p>{canCreate ? "No goals yet. Create the first one to start tracking progress." : "No goals yet. Goals appear here once someone in your organization sets them."}</p>
          {canCreate && <Button variant="primary" onClick={startCreate}>Create the first goal</Button>}
        </Card>
      ) : groups.map((group) => (
        <div className="home-goal-group" key={group.scope}>
          <h3>{group.title}</h3>
          <ul className="home-goal-list">
            {group.goals.map((goal) => (
              <li key={goal.id}>
                <GoalRow
                  goal={goal}
                  parentTitle={goal.parentId ? titles.get(goal.parentId) ?? null : null}
                  onOpen={() => onOpenGoal(goal.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Dialog open={creating} onClose={() => setCreating(false)} title="New goal" closeDisabled={saving} className="goal-dialog">
        {creating && options && (
          <GoalForm
            mode="create"
            options={options}
            initial={emptyGoalValues(options.scopes[0], today)}
            parents={goals}
            busy={saving}
            serverError={serverError}
            onSubmit={(values) => void create(values)}
            onCancel={() => setCreating(false)}
          />
        )}
      </Dialog>
    </section>
  );
}
