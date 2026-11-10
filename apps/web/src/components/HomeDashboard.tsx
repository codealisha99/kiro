"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { homeApi, type HomeResponse, type ThroughputResponse } from "@/lib/home-api";
import { scopeLabel, toIsoDay } from "@/lib/goal-format";
import { HomeGoals } from "./HomeGoals";
import { HomeSetup } from "./HomeSetup";
import { HomeHealth, HomeThroughput } from "./HomeInsights";
import { HomeStats } from "./HomeStats";
import { HomeTasks } from "./HomeTasks";
import { HomeTeam } from "./HomeTeam";
import "./home-dashboard.css";
import "./goals-page.css";

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

export default function HomeDashboard({ workspace = "your workspace" }: { workspace?: string }) {
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [throughput, setThroughput] = useState<ThroughputResponse | null>(null);
  const [throughputError, setThroughputError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const run = ++generation.current;
    setLoading(true);
    const [homeResult, throughputResult] = await Promise.allSettled([homeApi.home(), homeApi.throughput(8)]);
    if (run !== generation.current) return;
    if (homeResult.status === "fulfilled") {
      setHome(homeResult.value);
      setError(null);
    } else {
      setHome(null);
      setError(loadErrorMessage(homeResult.reason));
    }
    if (throughputResult.status === "fulfilled") {
      setThroughput(throughputResult.value);
      setThroughputError(null);
    } else {
      setThroughput(null);
      setThroughputError(loadErrorMessage(throughputResult.reason));
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

  return (
    <section className="home-dashboard" aria-busy={loading}>
      <header className="home-heading">
        <div>
          <p className="home-eyebrow">{scopeLabel(home.me.primaryView)}</p>
          <h1>Good {greetingPart(new Date())}, {firstName}</h1>
          <p className="muted">Your goals, your open work, and the people you can see.</p>
        </div>
      </header>
      {error && (
        <Alert tone="danger">
          {error} Access may have changed. <Button variant="secondary" size="small" onClick={() => void refresh()}>Refresh</Button>
        </Alert>
      )}
      <HomeSetup goals={home.goals.length} workspace={workspace} />
      <HomeStats home={home} throughput={throughput} />
      <div className="home-insights">
        <HomeThroughput throughput={throughput} error={throughputError} />
        <HomeHealth goals={home.goals} />
      </div>
      <HomeGoals goals={home.goals} />
      <HomeTasks tasks={home.myTasks} goals={home.goals} today={today} />
      <HomeTeam team={home.team} />
      <details className="home-method">
        <summary>How these numbers are calculated</summary>
        <p>{home.method}</p>
        {throughput && <p>{throughput.method}</p>}
        <p>Calculated {new Date(home.generatedAt).toLocaleString("en-US")}. Refresh the page after goals or work change.</p>
      </details>
    </section>
  );
}
