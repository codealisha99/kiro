"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/charts";
import { LENS_GOALS, LENS_PEOPLE, LENS_ROLES, lensHealth, visiblePeople, type LensRole } from "@/lib/scope-lens";

const HEALTH_TONE = { "On track": "good", "At risk": "warning", "Off track": "danger" } as const;

// One illustrative company seen through three roles. Switching role animates what leaves and
// enters that person's view: the org chart dims what is out of scope, and goal rows collapse.
export default function ScopeLens() {
  const [role, setRole] = useState<LensRole>("manager");
  const current = LENS_ROLES.find((r) => r.id === role)!;
  const people = visiblePeople(role);
  const viewer = LENS_PEOPLE.find((p) => p.id === current.viewer)!;
  const goals = LENS_GOALS.filter((g) => g.visibleTo.includes(role));

  return (
    <figure className="lens" aria-labelledby="lens-caption">
      <div className="lens-bar">
        <span className="lens-title">One company, seen by</span>
        <div className="lens-roles" role="radiogroup" aria-label="View the company as">
          {LENS_ROLES.map((r) => (
            <label key={r.id} className="lens-role">
              <input type="radio" name="lens-role" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} />
              <span>{r.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="lens-body" data-role={role}>
        <svg className="lens-graph" viewBox="0 0 540 420" aria-hidden="true" focusable="false">
          {LENS_PEOPLE.filter((p) => p.managerId).map((p) => {
            const m = LENS_PEOPLE.find((q) => q.id === p.managerId)!;
            const inScope = people.has(p.id) && people.has(m.id);
            return (
              <path
                key={p.id}
                className={`lens-edge${inScope ? " is-in" : ""}`}
                d={`M${m.x} ${m.y + 64} C${m.x} ${m.y + 84}, ${p.x} ${p.y - 46}, ${p.x} ${p.y - 25}`}
              />
            );
          })}
          {LENS_PEOPLE.map((p, i) => (
            <g
              key={p.id}
              className={`lens-node${people.has(p.id) ? " is-in" : ""}${p.id === viewer.id ? " is-viewer" : ""}`}
              style={{ transitionDelay: `${i * 30}ms` }}
              transform={`translate(${p.x} ${p.y})`}
            >
              <circle r="21" />
              <text className="lens-initial" dy="5">{p.name[0]}</text>
              <text className="lens-name" y="40">{p.name}</text>
              <text className="lens-meta" y="55">{p.title}</text>
            </g>
          ))}
        </svg>

        <div className="lens-panel">
          <p className="lens-kicker">{viewer.name}&rsquo;s Home</p>
          <p className="lens-rule">{current.rule}</p>
          <ul className="lens-goals">
            {LENS_GOALS.map((g) => {
              const shown = g.visibleTo.includes(role);
              const health = lensHealth(g);
              return (
                <li key={g.id} className={`lens-goal${shown ? "" : " is-out"}`} aria-hidden={!shown} inert={!shown}>
                  <div>
                    <div className="lens-goal-head">
                      <span className="lens-goal-scope">{g.scope} · {g.owner}</span>
                      <span className={`lens-health tone-${HEALTH_TONE[health]}`}>{health}</span>
                    </div>
                    <p className="lens-goal-title">{g.title}</p>
                    <ProgressBar
                      value={g.progress}
                      expected={g.expected}
                      label={g.title}
                      valueText={`${Math.round(g.progress * 100)}% complete. Expected ${Math.round(g.expected * 100)}% by today.`}
                      tone={HEALTH_TONE[health]}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <figcaption id="lens-caption" className="lens-caption">
        <span aria-live="polite">
          {viewer.name} sees {people.size} of {LENS_PEOPLE.length} people and {goals.length} of {LENS_GOALS.length} goals.
        </span>{" "}
        <span className="lens-note">Illustrative company. Kiro applies the same rules to your org chart.</span>
      </figcaption>
    </figure>
  );
}
