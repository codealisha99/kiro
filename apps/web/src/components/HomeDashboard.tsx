"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { homeApi, type GoalOptions, type HomeResponse } from "@/lib/home-api";
import { toIsoDay, scopeLabel } from "@/lib/goal-format";
import { GoalDialog } from "./GoalDialog";
import { HomeGoals } from "./HomeGoals";
import { HomeTasks } from "./HomeTasks";
import { HomeTeam } from "./HomeTeam";
import "./home-dashboard.css";

const SUMMARY_LABELS: [string, string][] = [
  ["tasks", "Tasks"],
  ["completed", "Completed"],
  ["blocked", "Blocked"],
  ["overdue", "Overdue"],
];

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) {
    return "Your home dashboard is not available to this account. Ask an administrator for access.";
  }
  return error instanceof Error ? error.message : "Your home dashboard could not be loaded.";
}

function greetingPart(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  return hour < 18 ? "afternoon" : "evening";
}

export default function HomeDashboard() {
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [options, setOptions] = useState<GoalOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const run = ++generation.current;
    setLoading(true);
    const [homeResult, optionsResult] = await Promise.allSettled([homeApi.home(), homeApi.goalOptions()]);
    if (run !== generation.current) return;
    if (homeResult.status === "fulfilled") {
      setHome(homeResult.value);
      setError(null);
    } else {
      setHome(null);
      setError(loadErrorMessage(homeResult.reason));
    }
    if (optionsResult.status === "fulfilled") {
      setOptions(optionsResult.value);
      setOptionsError(null);
    } else {
      setOptions(null);
      setOptionsError(loadErrorMessage(optionsResult.reason));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const activeGeneration = generation;
    void refresh();
    return () => { activeGeneration.current++; };
  }, [refresh]);

  if (!home) {
    return (
      <section className="home-dashboard" aria-busy={loading}>
        {loading ? <p role="status">Loading your goals and work…</p> : null}
        {error && (
          <Alert tone="danger">
            {error} <Button variant="secondary" size="small" onClick={() => void refresh()}>Try again</Button>
          </Alert>
        )}
      </section>
    );
  }

  const today = toIsoDay(new Date());
  const firstName = home.me.name.split(" ")[0] || home.me.name;
  const summary = SUMMARY_LABELS.filter(([key]) => home.scopeSummary.metrics[key] !== undefined && home.scopeSummary.metrics[key] !== null);

  return (
    <section className="home-dashboard" aria-busy={loading}>
      <header className="home-heading">
        <div>
          <p className="home-eyebrow">{scopeLabel(home.me.primaryView)}</p>
          <h1>Good {greetingPart(new Date())}, {firstName}</h1>
          <p className="muted">Your goals, your open work, and the people you can see.</p>
        </div>
        {summary.length > 0 && (
          <dl className="home-summary">
            {summary.map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{String(home.scopeSummary.metrics[key])}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>
      <details className="home-method">
        <summary>How these numbers are calculated</summary>
        <p>{home.method}</p>
        <p>Calculated {new Date(home.generatedAt).toLocaleString("en-US")}. Refresh after goals or work change.</p>
      </details>
      {error && (
        <Alert tone="danger">
          {error} Access may have changed. <Button variant="secondary" size="small" onClick={() => void refresh()}>Refresh</Button>
        </Alert>
      )}
      <HomeGoals
        goals={home.goals}
        viewerId={home.me.id}
        options={options}
        optionsError={optionsError}
        onOpenGoal={setGoalId}
        onChanged={() => void refresh()}
      />
      <HomeTasks tasks={home.myTasks} goals={home.goals} today={today} />
      <HomeTeam team={home.team} />
      <GoalDialog
        goalId={goalId}
        goals={home.goals}
        onClose={() => setGoalId(null)}
        onChanged={() => void refresh()}
      />
    </section>
  );
}
