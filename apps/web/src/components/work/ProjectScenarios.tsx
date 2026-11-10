"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, Dialog, Field, Input, Section } from "@/components/ui";
import { workApi, type WorkScenario } from "@/lib/work-api";
import { ScenarioDialog } from "./ScenarioDialog";
import { useAction } from "./use-action";

const MAX_COMPARE = 4;
const emptyAssumptions = { name: "", periodStart: "", periodEnd: "", availableHours: "", proposedHours: "", rationale: "" };

export function ProjectScenarios({ projectId, canWrite, viewerId, pendingScenario, onPendingHandled }: {
  projectId: string;
  canWrite: boolean;
  viewerId: string;
  pendingScenario: WorkScenario | null;
  onPendingHandled: () => void;
}) {
  const [saved, setSaved] = useState<WorkScenario[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<WorkScenario[] | null>(null);
  const [review, setReview] = useState<WorkScenario | null>(null);
  const [assumptions, setAssumptions] = useState(emptyAssumptions);
  const { busy, error, run } = useAction();

  const loadSaved = useCallback(() => workApi.scenarios(projectId).then(setSaved), [projectId]);
  useEffect(() => { void run(loadSaved); }, [loadSaved, run]);

  // A scenario opened from a notification arrives here already loaded.
  useEffect(() => {
    if (!pendingScenario) return;
    setReview(pendingScenario);
    onPendingHandled();
  }, [pendingScenario, onPendingHandled]);

  async function applyChange(updated: WorkScenario) {
    setReview(updated);
    await loadSaved();
  }

  return (
    <>
      {canWrite && (
        <Section title="Evaluate proposed work" description="Compare recorded effort with explicit assumptions for this project. This does not forecast delivery or account for work outside this project.">
          {error && <p role="alert" className="work-danger">{error}</p>}
          <form className="work-form" onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              setReview(await workApi.scenario(projectId, { ...assumptions, availableHours: Number(assumptions.availableHours), proposedHours: Number(assumptions.proposedHours) }));
              await loadSaved();
            });
          }}>
            <Field label="Scenario name">{(f) => <Input {...f} required maxLength={200} value={assumptions.name} onChange={(e) => setAssumptions({ ...assumptions, name: e.target.value })} />}</Field>
            <Field label="Planning period starts">{(f) => <Input {...f} required type="date" value={assumptions.periodStart} onChange={(e) => setAssumptions({ ...assumptions, periodStart: e.target.value })} />}</Field>
            <Field label="Planning period ends">{(f) => <Input {...f} required type="date" min={assumptions.periodStart} value={assumptions.periodEnd} onChange={(e) => setAssumptions({ ...assumptions, periodEnd: e.target.value })} />}</Field>
            <Field label="Assumed available project hours">{(f) => <Input {...f} required type="number" min="0.01" max="100000" step="0.01" value={assumptions.availableHours} onChange={(e) => setAssumptions({ ...assumptions, availableHours: e.target.value })} />}</Field>
            <Field label="Estimated hours for proposed work">{(f) => <Input {...f} required type="number" min="0" max="100000" step="0.01" value={assumptions.proposedHours} onChange={(e) => setAssumptions({ ...assumptions, proposedHours: e.target.value })} />}</Field>
            <Field label="Basis for these assumptions">{(f) => <Input {...f} required maxLength={1000} value={assumptions.rationale} onChange={(e) => setAssumptions({ ...assumptions, rationale: e.target.value })} />}</Field>
            <Button type="submit" disabled={busy}>Evaluate and save scenario</Button>
          </form>
        </Section>
      )}
      <Section title="Saved scenarios" description={`Compare two to ${MAX_COMPARE} saved scenarios for this project. Each result uses its saved task evidence and declared assumptions.`}>
        {!saved.length ? <p>No saved scenarios yet.{canWrite ? " Create one above to start a comparison." : ""}</p> : <>
          <ul className="work-plain-list">{saved.map((s) => (
            <li key={s.id} className="work-scenario-row">
              <label>
                <input type="checkbox" checked={selectedIds.includes(s.id)} disabled={busy || (!selectedIds.includes(s.id) && selectedIds.length >= MAX_COMPARE)}
                  onChange={(e) => setSelectedIds((current) => e.target.checked ? [...current, s.id] : current.filter((id) => id !== s.id))} />
                <span><strong>{s.name}</strong><small>{s.assessment.replaceAll("_", " ")} · {s.period_start} to {s.period_end} · Approval: {s.approval.status.toLowerCase()}</small></span>
              </label>
              <Button variant="secondary" size="small" disabled={busy} onClick={() => setReview(s)}>Review</Button>
            </li>
          ))}</ul>
          <Button variant="secondary" disabled={busy || selectedIds.length < 2} onClick={() => void run(async () => setComparison(await workApi.compareScenarios(projectId, selectedIds)))}>Compare selected scenarios</Button>
        </>}
      </Section>
      <ScenarioDialog scenario={review} canWrite={canWrite} viewerId={viewerId} onClose={() => setReview(null)} onChange={applyChange} />
      <Dialog open={!!comparison} onClose={() => setComparison(null)} title="Scenario comparison">
        {comparison && <>
          <p>Saved calculations for the selected project. Values retain each scenario’s original evidence snapshot.</p>
          <div className="scenario-table-wrap"><table className="scenario-table"><thead><tr><th>Scenario</th><th>Assessment</th><th>Approval</th><th>Outcome</th><th>Actual hours</th><th>Recorded effort</th><th>Proposed</th><th>Assumed capacity</th><th>Remaining</th><th>Data gaps</th></tr></thead>
            <tbody>{comparison.map((s) => <tr key={s.id}><th scope="row">{s.name}</th><td>{s.assessment.replaceAll("_", " ")}</td>
              <td>{s.approval.status.toLowerCase()}</td><td>{s.outcome.status.toLowerCase().replaceAll("_", " ")}</td>
              <td>{s.outcome.actual_hours == null ? "Unknown" : `${s.outcome.actual_hours} h`}</td>
              <td>{s.known_remaining_hours} h</td><td>{s.proposed_hours} h</td><td>{s.available_hours} h</td>
              <td>{s.remaining_assumed_hours === null ? "Withheld" : `${s.remaining_assumed_hours} h`}</td>
              <td>{s.missing_estimates} missing estimates; {s.undated_tasks} undated</td></tr>)}</tbody></table></div>
          <p>These are assumption-based what-if calculations, not forecasts. Capacity is withheld for scenarios with missing estimates or undated tasks.</p>
        </>}
      </Dialog>
    </>
  );
}
