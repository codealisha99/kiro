import type { CSSProperties } from "react";

// A worked example of how Kiro reads one metric goal. Numbers are illustrative; the rules
// (progress, expected-by-today, health thresholds, remaining) are the API's.
const START = 800;
const TARGET = 1200;
const CURRENT = 1008;
const EXPECTED = 0.72;
const progress = (CURRENT - START) / (TARGET - START);
const gap = Math.round((EXPECTED - progress) * 100);
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function GoalAnatomy() {
  return (
    <figure className="anatomy" aria-labelledby="anatomy-caption">
      <p className="anatomy-goal">
        <span>Company goal</span> Reach 1,200 active customers
      </p>
      <div className="anatomy-chart" aria-hidden="true" style={{ "--p": progress, "--e": EXPECTED } as CSSProperties}>
        <span className="anatomy-tag tag-now">Now · {CURRENT.toLocaleString("en-US")} ({pct(progress)})</span>
        <span className="anatomy-tag tag-expected">Expected today · {pct(EXPECTED)}</span>
        <span className="anatomy-track">
          <span className="anatomy-fill" />
          <span className="anatomy-gap" />
          <span className="anatomy-marker" />
        </span>
        <span className="anatomy-ends">
          <span>Start · {START.toLocaleString("en-US")}</span>
          <span>Target · {TARGET.toLocaleString("en-US")}</span>
        </span>
      </div>
      <dl className="anatomy-facts">
        <div>
          <dt>Progress</dt>
          <dd>{pct(progress)}</dd>
        </div>
        <div>
          <dt>Behind today&rsquo;s pace</dt>
          <dd>{gap} points</dd>
        </div>
        <div>
          <dt>Health</dt>
          <dd className="tone-warning">At risk</dd>
        </div>
        <div>
          <dt>Customers to go</dt>
          <dd>{(TARGET - CURRENT).toLocaleString("en-US")}</dd>
        </div>
      </dl>
      <ol className="anatomy-scale" aria-label="How health is decided">
        <li className="tone-good"><strong>On track</strong> up to 10 points behind</li>
        <li className="tone-warning"><strong>At risk</strong> 10 to 25 points behind</li>
        <li className="tone-danger"><strong>Off track</strong> further behind, or past due</li>
      </ol>
      <figcaption id="anatomy-caption" className="anatomy-caption">
        Illustrative goal. Expected progress runs evenly from the start date to the due date.
      </figcaption>
    </figure>
  );
}
