"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { homeApi, type GoalDetail } from "@/lib/home-api";
import { CHECKIN_NOTE_MAX, validateCheckin } from "@/lib/goal-draft";

export function GoalCheckinForm({ goal, onSaved }: { goal: GoalDetail; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ value?: string; note?: string }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateCheckin(goal.measure, value, note);
    setErrors(checked.errors);
    if (Object.values(checked.errors).some(Boolean)) return;
    setSaving(true); setSaveError(null);
    try {
      await homeApi.checkIn(goal.id, { value: checked.value, note: note.trim() });
      setValue(""); setNote("");
      onSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The check-in could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="goal-form" onSubmit={submit} noValidate aria-busy={saving}>
      {saveError && <Alert tone="danger">{saveError}</Alert>}
      {goal.measure === "METRIC" && (
        <Field label={`New value${goal.unit ? ` (${goal.unit})` : ""}`} hint="Updates the current value and progress." error={errors.value}>
          {(field) => <Input {...field} type="number" inputMode="decimal" step="any" value={value} disabled={saving} onChange={(event) => setValue(event.target.value)} />}
        </Field>
      )}
      <Field label="Update note" hint={`What changed. Up to ${CHECKIN_NOTE_MAX} characters.`} error={errors.note}>
        {(field) => <Textarea {...field} rows={2} maxLength={CHECKIN_NOTE_MAX} value={note} disabled={saving} onChange={(event) => setNote(event.target.value)} />}
      </Field>
      <div className="goal-form-actions">
        <Button variant="primary" type="submit" disabled={saving}>{saving ? "Saving check-in…" : "Add check-in"}</Button>
      </div>
    </form>
  );
}
