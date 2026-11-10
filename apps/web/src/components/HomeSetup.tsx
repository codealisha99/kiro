"use client";

import { useEffect, useState } from "react";
import { ProgressBar } from "@/components/charts";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { openView } from "@/lib/goal-nav";
import { orgApi } from "@/lib/organization-api";
import { realPeople, setupProgress, setupSteps, type SetupFacts } from "@/lib/setup-checklist";
import { WorkspaceIcon } from "./WorkspaceIcon";

const HIDDEN_KEY = "kiro-setup-hidden";

type Load = { status: "loading" } | { status: "hidden" } | { status: "error" } | { status: "ready"; facts: SetupFacts };

// Setup guide for whoever can manage the organization. It disappears once every step is done.
export function HomeSetup({ goals, workspace }: { goals: number; workspace: string }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readHidden());
    let active = true;
    (async () => {
      try {
        const setup = await orgApi.setup();
        if (!setup.canManage) return active && setLoad({ status: "hidden" });
        const [connections, documents] = await Promise.all([orgApi.connections(), api.documents()]);
        if (!active) return;
        setLoad({
          status: "ready",
          facts: {
            documents: documents.length,
            readyConnections: connections.filter((c) => c.status === "READY").length,
            teams: setup.teams?.length ?? 0,
            people: realPeople(setup.users ?? []),
            reportingLines: setup.reporting?.length ?? 0,
            roleBindings: setup.bindings?.length ?? 0,
            goals,
          },
        });
      } catch {
        if (active) setLoad({ status: "error" });
      }
    })();
    return () => { active = false; };
  }, [goals]);

  if (load.status === "loading" || load.status === "hidden") return null;
  if (load.status === "error") return <p className="home-setup-error">Setup progress could not be loaded. Refresh to try again.</p>;

  const steps = setupSteps(load.facts);
  const progress = setupProgress(steps);
  if (progress.complete) return null;

  function hide(next: boolean) {
    setCollapsed(next);
    try { window.localStorage.setItem(HIDDEN_KEY, next ? "1" : "0"); } catch { /* the choice still applies for this visit */ }
  }

  if (collapsed) {
    return (
      <p className="home-setup-collapsed">
        Setup: {progress.done} of {progress.total} done.{" "}
        <button type="button" className="home-setup-link" onClick={() => hide(false)}>Show the guide</button>
      </p>
    );
  }

  return (
    <section className="home-setup" aria-labelledby="home-setup-title">
      <header className="home-setup-head">
        <div>
          <h2 id="home-setup-title">Set up {workspace}</h2>
          <p>A few steps turn an empty desk into one your whole company can ask.</p>
        </div>
        <Button variant="secondary" size="small" onClick={() => hide(true)}>Hide for now</Button>
      </header>
      <div className="home-setup-progress">
        <ProgressBar value={progress.done / progress.total} label="Setup progress" valueText={`${progress.done} of ${progress.total} steps done`} />
        <span className="home-setup-count">{progress.done} of {progress.total} done</span>
      </div>
      <ol className="home-setup-steps">
        {steps.map((step, index) => (
          <li key={step.id} className={step.done ? "is-done" : step === progress.next ? "is-next" : undefined}>
            <span className="home-setup-mark" aria-hidden="true">
              {step.done ? <WorkspaceIcon name="check" width="14" height="14" /> : index + 1}
            </span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
            {step.done ? (
              <span className="home-setup-done">Done</span>
            ) : (
              <Button
                variant={step === progress.next ? "primary" : "secondary"}
                size="small"
                onClick={() => openView(step.action.view, { tab: step.action.tab ?? null })}
              >
                {step.action.label}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function readHidden() {
  try { return window.localStorage.getItem(HIDDEN_KEY) === "1"; } catch { return false; }
}
