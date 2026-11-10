import type { Metadata } from "next";
import Link from "next/link";
import LandingDemo from "@/components/LandingDemo";
import GoalAnatomy from "@/components/landing/GoalAnatomy";
import ScopeLens from "@/components/landing/ScopeLens";
import { KiroMark, WorkspaceIcon, type IconName } from "@/components/WorkspaceIcon";
import "./landing.css";
import "./landing-story.css";

export const metadata: Metadata = {
  title: "Kiro — Ask your company what's happening",
  description:
    "Kiro connects your documents and tools, answers with the source beside it, and shows everyone the goals and work their role allows.",
  openGraph: {
    title: "Kiro — Ask your company what's happening",
    description:
      "Documents, Slack, Linear, GitHub and more in one desk. Cited answers, goals and dashboards, scoped to each person's role.",
    type: "website",
  },
};

// Only providers the API can connect today (integration/ProviderGateway).
const connectors = ["Slack", "Linear", "GitHub", "Google Drive", "Google Analytics", "HubSpot", "Xero"];

const trail = [
  { source: "Slack", item: "#checkout-launch", detail: "214 messages since Monday" },
  { source: "Linear", item: "CHK-482 Payment retries", detail: "Blocked · 6 days" },
  { source: "GitHub", item: "PR #913 Retry queue", detail: "Waiting for review" },
  { source: "Drive", item: "Q4 plan (final v7)", detail: "Edited by 4 people" },
];

const stages: { id: string; icon: IconName; title: string; text: string }[] = [
  {
    id: "connect",
    icon: "plug",
    title: "Connect what you already use",
    text: "Upload handbooks and notes, or connect your tools. Kiro keeps each source's own record and its access rules.",
  },
  {
    id: "scope",
    icon: "shield",
    title: "Map who can see what",
    text: "Reporting lines, teams, roles and document grants form one graph. Every question is answered inside the asker's part of it.",
  },
  {
    id: "answer",
    icon: "message",
    title: "Ask, track, and decide",
    text: "Ask in plain language and read the cited answer. Home, Goals and company dashboards show the same scoped picture as numbers.",
  },
];

const trust: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "shield",
    title: "Checked inside every query",
    text: "Permissions are applied in the database query itself, so records you can't see never leave the database.",
  },
  {
    icon: "lock",
    title: "Access stays with the document",
    text: "Restricted documents are readable only by their owner and the people or roles they're shared with.",
  },
  {
    icon: "plug",
    title: "Fresh, or left out",
    text: "Answers only use a connected tool that synced in the last 24 hours. Stale data is skipped instead of quoted.",
  },
  {
    icon: "search",
    title: "Room for “we don’t know”",
    text: "When the sources don't support an answer, Kiro says so, and your team can add what's missing.",
  },
];

const faqs = [
  {
    q: "Which tools can Kiro connect to?",
    a: "Slack, Linear, GitHub, Google Drive, Google Analytics, HubSpot and Xero. You can also upload PDF, DOCX, XLSX, CSV, Markdown or text files up to 10 MB, or paste text directly.",
  },
  {
    q: "How does Kiro decide what I can see?",
    a: "From your organization: who you report to, the teams you're on, and the roles you hold. A company-wide role sees everything, a manager sees their reporting line, and everyone sees their own work, their team's goals and the goals above them. Restricted documents also need an explicit grant.",
  },
  {
    q: "Can I try it before connecting anything?",
    a: "Yes. Create a workspace and load the sample documents to explore questions, answers and citations. The examples on this page are illustrative and don't touch any company's data.",
  },
  {
    q: "Does every question get an answer?",
    a: "Kiro works from the sources available to you. If there isn't enough evidence, it tells you. Source-backed search and excerpts work out of the box; AI-written answers and semantic search need an AI provider to be configured.",
  },
];

export default function Page() {
  return (
    <div className="landing">
      <a className="landing-skip" href="#main">
        Skip to content
      </a>
      <header className="landing-header landing-container">
        <Link className="landing-brand" href="/" aria-label="Kiro home">
          <KiroMark />
          <span>kiro</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#evidence">Evidence</a>
          <a href="#trust">Security</a>
          <Link href="/app">Sign in</Link>
        </nav>
        <Link className="btn signal" href="/app?mode=register">
          Create a workspace <WorkspaceIcon name="chevron" />
        </Link>
      </header>

      <main id="main">
        <section className="story-hero landing-container" aria-labelledby="hero-title">
          <p className="hero-intro">
            <span aria-hidden="true" /> Knowledge, goals and work, in one desk
          </p>
          <div className="story-hero-grid">
            <h1 id="hero-title">
              Ask your company
              <br />
              what&rsquo;s happening.
            </h1>
            <div className="story-hero-side">
              <p className="hero-description">
                Kiro brings your documents and tools together, answers with the source beside it, and
                shows each person the goals and work their role allows.
              </p>
              <div className="hero-actions">
                <Link className="btn signal" href="/app?mode=register">
                  Create your workspace <WorkspaceIcon name="chevron" />
                </Link>
                <a className="hero-demo-link" href="#how-it-works">
                  See how it works <span aria-hidden="true">↓</span>
                </a>
              </div>
            </div>
          </div>
          <ScopeLens />
        </section>

        <section className="story-problem landing-container reveal" aria-labelledby="problem-title">
          <div className="story-problem-intro">
            <p className="landing-section-note">The problem</p>
            <h2 id="problem-title">
              The status exists.
              <br />
              It&rsquo;s in four places.
            </h2>
            <p>
              Asking &ldquo;where are we on checkout?&rdquo; usually means a thread, a ticket, a pull
              request and a spreadsheet, and hoping you were allowed to open all of them.
            </p>
          </div>
          <div className="story-compare">
            <div className="compare-before">
              <p className="compare-label">Today</p>
              <ul>
                {trail.map((t) => (
                  <li key={t.item}>
                    <span className="compare-source">{t.source}</span>
                    <span className="compare-item">{t.item}</span>
                    <span className="compare-detail">{t.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="compare-after">
              <p className="compare-label">With Kiro</p>
              <p className="compare-question">Where are we on checkout?</p>
              <p className="compare-answer">
                Checkout v2 is behind plan. Payment retries have been blocked for six days
                <span className="compare-cite">Linear</span>, waiting on the retry-queue review
                <span className="compare-cite">GitHub</span>. The team agreed to move launch by a week
                <span className="compare-cite">Slack</span>.
              </p>
              <p className="compare-note">Illustrative answer. Each citation opens the record it came from.</p>
            </div>
          </div>
        </section>

        <section className="story-flow" id="how-it-works" aria-labelledby="flow-title">
          <div className="landing-container">
            <div className="story-flow-intro reveal">
              <p className="landing-section-note">How it works</p>
              <h2 id="flow-title">Connect. Scope. Answer.</h2>
            </div>
            <ol className="flow-stages">
              {stages.map((s, i) => (
                <li key={s.id} className="flow-stage reveal">
                  <span className="flow-index">0{i + 1}</span>
                  <WorkspaceIcon name={s.icon} />
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  {s.id === "connect" && (
                    <ul className="flow-chips" aria-label="Tools Kiro connects to">
                      {connectors.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                      <li className="is-files">Your files</li>
                    </ul>
                  )}
                  {s.id === "scope" && (
                    <ul className="flow-edges" aria-label="Relationships Kiro uses">
                      <li><span>Reports to</span> manager</li>
                      <li><span>Member of</span> team</li>
                      <li><span>Holds</span> role, scoped to a team, department or company</li>
                      <li><span>Granted</span> restricted document</li>
                    </ul>
                  )}
                  {s.id === "answer" && (
                    <ul className="flow-edges" aria-label="Where answers appear">
                      <li><span>Ask Kiro</span> cited answers</li>
                      <li><span>Home</span> your goals, tasks and team</li>
                      <li><span>Goals</span> progress against today</li>
                      <li><span>Dashboards</span> company metrics by role</li>
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="story-evidence landing-container" id="evidence" aria-labelledby="evidence-title">
          <div className="story-evidence-copy reveal">
            <p className="landing-section-note">Built around the evidence</p>
            <h2 id="evidence-title">
              Every answer
              <br />
              shows its work.
            </h2>
            <p>
              Pick a question. The answer names its source, and the passage behind it is one click away,
              so you can check it before you act on it.
            </p>
          </div>
          <LandingDemo />
        </section>

        <section className="story-goals landing-container reveal" aria-labelledby="goals-title">
          <div className="story-goals-copy">
            <p className="landing-section-note">Goals</p>
            <h2 id="goals-title">
              Not just how far
              <br />
              you&rsquo;ve come.
            </h2>
            <p>
              Every goal is measured against where it should be today. The gap decides its health, and the
              distance to target is stated in the goal&rsquo;s own unit.
            </p>
          </div>
          <GoalAnatomy />
        </section>

        <section className="landing-trust" id="trust" aria-labelledby="trust-title">
          <div className="landing-container trust-grid">
            <div className="reveal">
              <p className="landing-section-note">Trust and access</p>
              <h2 id="trust-title">
                Access is enforced
                <br />
                where the data lives.
              </h2>
              <p className="trust-description">
                Kiro doesn&rsquo;t fetch everything and hide what you shouldn&rsquo;t see. It only ever
                asks for what you&rsquo;re allowed to read.
              </p>
              <Link href="/app" className="trust-link">
                Open your workspace <WorkspaceIcon name="chevron" />
              </Link>
            </div>
            <div className="trust-details">
              {trust.map((t) => (
                <article key={t.title} className="reveal">
                  <WorkspaceIcon name={t.icon} />
                  <div>
                    <h3>{t.title}</h3>
                    <p>{t.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-faq landing-container" aria-labelledby="faq-title">
          <div>
            <p className="landing-section-note">A few things to know</p>
            <h2 id="faq-title">
              Before you
              <br />
              open the desk.
            </h2>
          </div>
          <div className="faq-items">
            {faqs.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-closing landing-container reveal">
          <div className="closing-mark">
            <KiroMark />
          </div>
          <h2>
            Your next answer
            <br />
            is already in there.
          </h2>
          <p>Give your company&rsquo;s knowledge, goals and work one honest place to live.</p>
          <Link className="btn signal" href="/app?mode=register">
            Create your workspace <WorkspaceIcon name="chevron" />
          </Link>
        </section>
      </main>

      <footer className="landing-footer landing-container">
        <Link className="landing-brand" href="/" aria-label="Kiro home">
          <KiroMark />
          <span>kiro</span>
        </Link>
        <p>Company knowledge. With the source.</p>
        <Link href="/app">Open the desk</Link>
        <div className="landing-credits">
          <span>
            Maintained by <a href="https://alishakarma.com">Alisha Karma</a>
          </span>
          <a href="https://github.com/codealisha99/kiro">GitHub</a>
          <a href="mailto:lishykarma99@gmail.com">Contact</a>
        </div>
      </footer>
    </div>
  );
}
