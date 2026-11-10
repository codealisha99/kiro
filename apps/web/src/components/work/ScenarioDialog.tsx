"use client";
import { useState, type FormEvent } from "react";
import { Badge, Button, Dialog, Field, Input, Select } from "@/components/ui";
import { workApi, type WorkScenario } from "@/lib/work-api";
import { useAction } from "./use-action";

type OutcomeStatus = "IN_PROGRESS" | "DELIVERED" | "NOT_DELIVERED" | "CANCELLED";

// Review a what-if scenario: approval (by a different editor), outcome, and the evidence it used.
export function ScenarioDialog({ scenario, canWrite, viewerId, onClose, onChange }: {
  scenario: WorkScenario | null;
  canWrite: boolean;
  viewerId: string;
  onClose: () => void;
  onChange: (updated: WorkScenario) => Promise<void>;
}) {
  const { busy, run } = useAction();
  return (
    <Dialog open={!!scenario} onClose={onClose} closeDisabled={busy} title="Scenario result">
      {scenario && (
        <ScenarioBody
          key={`${scenario.id}-${scenario.approval.version}-${scenario.outcome.version}`}
          scenario={scenario}
          canWrite={canWrite}
          viewerId={viewerId}
          busy={busy}
          run={run}
          onChange={onChange}
        />
      )}
    </Dialog>
  );
}

function ScenarioBody({ scenario, canWrite, viewerId, busy, run, onChange }: {
  scenario: WorkScenario;
  canWrite: boolean;
  viewerId: string;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  onChange: (updated: WorkScenario) => Promise<void>;
}) {
  const [approvalReason, setApprovalReason] = useState("");
  const [outcome, setOutcome] = useState({
    status: (scenario.outcome.status === "NONE" ? "IN_PROGRESS" : scenario.outcome.status) as OutcomeStatus,
    actualHours: scenario.outcome.actual_hours == null ? "" : String(scenario.outcome.actual_hours),
    note: scenario.outcome.note ?? "",
  });
  const delta = scenario.outcome.actual_hours == null ? null : scenario.outcome.actual_hours - scenario.proposed_hours;

  async function saveOutcome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => onChange(await workApi.saveScenarioOutcome(scenario.id, {
      status: outcome.status,
      actualHours: outcome.actualHours === "" ? null : Number(outcome.actualHours),
      note: outcome.note,
      expectedVersion: scenario.outcome.version,
    })));
  }

  return (
    <>
      <Badge>What-if calculation</Badge>
      <h3>{scenario.name}</h3>
      <p>{scenario.assessment.replaceAll("_", " ")}</p>
      <p>Known remaining effort: {scenario.known_remaining_hours} hours. Proposed work: {scenario.proposed_hours} hours. Assumed availability: {scenario.available_hours} hours.</p>
      <p>{scenario.remaining_assumed_hours === null ? "Capacity conclusion withheld because required data is missing." : `Remaining assumed capacity: ${scenario.remaining_assumed_hours} hours.`}</p>
      <p>{scenario.missing_estimates} missing estimates; {scenario.undated_tasks} undated tasks.</p>
      <p>{scenario.method}</p>
      <p>{scenario.limitations}</p>
      <p>Approval status: {scenario.approval.status.toLowerCase()}. {scenario.approval.reason}</p>
      {scenario.approval.status === "NONE" && canWrite && (
        <Button disabled={busy} onClick={() => void run(async () => onChange(await workApi.requestScenarioApproval(scenario.id)))}>Request approval</Button>
      )}
      {scenario.approval.status === "PENDING" && scenario.approval.requested_by === viewerId && <p>Waiting for a different project editor to review this request.</p>}
      {scenario.approval.status === "PENDING" && canWrite && scenario.approval.requested_by !== viewerId && (
        <div className="work-form">
          <Field label="Decision reason" hint="Required when rejecting this scenario.">{(f) => (
            <Input {...f} maxLength={1000} disabled={busy} value={approvalReason} onChange={(e) => setApprovalReason(e.target.value)} />
          )}</Field>
          <div className="work-actions">
            <Button disabled={busy} onClick={() => void run(async () => onChange(await workApi.decideScenarioApproval(scenario.id, "APPROVED", approvalReason, scenario.approval.version)))}>Approve</Button>
            <Button variant="secondary" disabled={busy || !approvalReason.trim()} onClick={() => void run(async () => onChange(await workApi.decideScenarioApproval(scenario.id, "REJECTED", approvalReason, scenario.approval.version)))}>Reject</Button>
          </div>
        </div>
      )}
      <p>Approval records an internal decision only. It does not execute a change in an external service.</p>
      <p>
        Recorded outcome: {scenario.outcome.status === "NONE" ? "not recorded" : scenario.outcome.status.toLowerCase().replaceAll("_", " ")}.
        {scenario.outcome.actual_hours == null ? " Actual effort not recorded." : ` Actual effort: ${scenario.outcome.actual_hours} hours (${delta !== null && delta >= 0 ? "+" : ""}${delta} hours against the estimate).`}
        {scenario.outcome.note ? ` ${scenario.outcome.note}` : ""}
      </p>
      {canWrite && (
        <form className="work-form" onSubmit={(e) => void saveOutcome(e)}>
          <Field label="Outcome status">{(f) => (
            <Select {...f} disabled={busy} value={outcome.status} onChange={(e) => setOutcome({ ...outcome, status: e.target.value as OutcomeStatus })}>
              <option value="IN_PROGRESS">In progress</option><option value="DELIVERED">Delivered</option><option value="NOT_DELIVERED">Not delivered</option><option value="CANCELLED">Cancelled</option>
            </Select>
          )}</Field>
          <Field label="Actual effort on proposed work (hours)" hint="Leave blank if unknown.">{(f) => (
            <Input {...f} disabled={busy} type="number" min="0" max="100000" step="0.01" value={outcome.actualHours} onChange={(e) => setOutcome({ ...outcome, actualHours: e.target.value })} />
          )}</Field>
          <Field label="Outcome note">{(f) => <Input {...f} required maxLength={1000} disabled={busy} value={outcome.note} onChange={(e) => setOutcome({ ...outcome, note: e.target.value })} />}</Field>
          <Button type="submit" disabled={busy || !outcome.note.trim()}>Save outcome</Button>
        </form>
      )}
      <details>
        <summary>Evidence snapshot</summary>
        <ul>{scenario.evidence.map((e) => <li key={e.task_id}>Task {e.task_id}, version {e.task_version}: {e.remaining_hours ?? "unknown"} hours, due {e.due_date ?? "unknown"}.</li>)}</ul>
      </details>
    </>
  );
}
