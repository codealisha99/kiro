"use client";

import { useState } from "react";
import { Alert, Dialog } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { homeApi, type Goal, type GoalOptions } from "@/lib/home-api";
import { emptyGoalValues, toGoalDraft, validateGoalValues, type GoalFormValues } from "@/lib/goal-draft";
import { toIsoDay } from "@/lib/goal-format";
import { GoalForm } from "./GoalForm";

export interface GoalDialogProps {
  open: boolean;
  options: GoalOptions | null;
  optionsError: string | null;
  /** Visible goals, offered as parents for the new goal. */
  goals: Goal[];
  viewerId: string;
  onClose: () => void;
  onCreated: (goal: Goal) => void;
}

function createErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return "You do not have permission to create goals in this scope.";
  return error instanceof Error ? error.message : "The goal could not be saved. Try again.";
}

/** Create-only dialog. Edits happen in the goal panel so the detail stays visible. */
export function GoalDialog({ open, options, optionsError, goals, viewerId, onClose, onCreated }: GoalDialogProps) {
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function create(values: GoalFormValues) {
    if (Object.values(validateGoalValues(values)).some(Boolean)) return;
    setSaving(true); setServerError(null);
    try {
      onCreated(await homeApi.createGoal(toGoalDraft(values, viewerId)));
    } catch (error) {
      setServerError(createErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New goal" closeDisabled={saving} className="goal-dialog">
      {open && !options && (optionsError
        ? <Alert tone="warning">Goal creation is unavailable right now. {optionsError}</Alert>
        : <p role="status" className="muted">Loading goal options…</p>)}
      {open && options && (
        <GoalForm
          mode="create"
          options={options}
          initial={emptyGoalValues(options.scopes[0], toIsoDay(new Date()))}
          parents={goals}
          busy={saving}
          serverError={serverError}
          onSubmit={(values) => void create(values)}
          onCancel={onClose}
        />
      )}
    </Dialog>
  );
}
