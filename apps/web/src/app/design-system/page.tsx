"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import "./design-system.css";

const sections = ["Foundations", "Typography", "Components", "In context"];
const colors = [
  ["Canvas", "--color-canvas", "#e3e7df"],
  ["Paper", "--color-surface", "#f2f4ee"],
  ["Ink", "--color-text", "#172b29"],
  ["Teal", "--color-accent", "#0a5c63"],
  ["Source", "--color-marker", "#ad4121"],
];

export default function DesignSystemPage() {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("Evidence");
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState(false);
  return (
    <div className="system" data-theme={dark ? "dark" : "light"}>
      <aside className="system-nav">
        <Link href="/" className="system-brand">
          kiro
          <span className="system-brand-dot" />
        </Link>
        <p className="section-label">Design language / 01</p>
        <nav aria-label="Design system sections">
          {sections.map((section, i) => (
            <a
              key={section}
              href={`#${section.toLowerCase().replaceAll(" ", "-")}`}
            >
              <span>0{i + 1}</span>
              {section}
            </a>
          ))}
        </nav>
        <div className="system-nav-footer">
          <p>Answers with a paper trail.</p>
          <Link href="/">Open the desk ↗</Link>
        </div>
      </aside>

      <main className="system-main">
        <header className="system-top">
          <span className="kicker">KIRO / DESIGN SYSTEM</span>
          <Button
            variant="secondary"
            size="small"
            aria-pressed={dark}
            onClick={() => setDark(!dark)}
          >
            {dark ? "Light preview" : "Dark preview"}
          </Button>
        </header>
        <section className="system-hero" id="foundations">
          <div className="system-eyebrow">
            <span className="system-brand-dot" /> A quieter kind of clarity
          </div>
          <h1>
            Clarity, with
            <br />a paper trail.
          </h1>
          <p>
            A considered space for what your company knows. Calm surfaces,
            readable answers, and evidence that stays close.
          </p>
          <div className="system-principles">
            <span>01 / Trust comes first</span>
            <span>02 / Give words room</span>
            <span>03 / Keep the source visible</span>
          </div>
        </section>

        <section className="system-section" aria-labelledby="palette-title">
          <div className="system-section-heading">
            <div>
              <p className="section-label">01 / Foundations</p>
              <h2 id="palette-title">Paper, ink, and a signal.</h2>
            </div>
            <p>
              Teal guides the action.
              <br />
              Terracotta marks the evidence.
            </p>
          </div>
          <div className="system-swatches">
            {colors.map(([name, token, hex]) => (
              <div className="system-swatch" key={name}>
                <div style={{ background: `var(${token})` }} />
                <strong>{name}</strong>
                <code>
                  {dark ? token.replace("--color-", "") + " / dark" : hex}
                </code>
              </div>
            ))}
          </div>
          <div className="system-foundation-notes">
            <p>
              <strong>4px rhythm</strong>Consistent spacing, from compact labels
              to generous reading space.
            </p>
            <p>
              <strong>Purposeful edges</strong>8px controls, 12px panels. Pills
              belong to metadata.
            </p>
            <p>
              <strong>Quiet motion</strong>120–180ms feedback. Reduced motion is
              respected.
            </p>
          </div>
        </section>

        <section className="system-section" id="typography">
          <div className="system-section-heading">
            <div>
              <p className="section-label">02 / Typography</p>
              <h2>A voice for every layer.</h2>
            </div>
            <p>
              Three families.
              <br />
              One clear hierarchy.
            </p>
          </div>
          <div className="system-type-grid">
            <Card>
              <p className="section-label">IBM Plex Serif / Editorial</p>
              <p className="system-type-serif">
                The answer is
                <br />
                in the details.
              </p>
              <p className="muted">
                Headlines, answers, and source passages. A reading voice with a
                human cadence.
              </p>
            </Card>
            <Card>
              <p className="section-label">Outfit / Interface</p>
              <p className="system-type-sans">
                Find what
                <br />
                you need.
              </p>
              <p className="muted">
                Navigation, forms, and actions. Direct, legible, and comfortable
                at small sizes.
              </p>
            </Card>
            <Card>
              <p className="section-label">IBM Plex Mono / Metadata</p>
              <p className="system-type-mono">
                SOURCE 03
                <br />
                POLICY / V.02
                <br />
                VERIFIED
              </p>
              <p className="muted">
                Provenance, labels, and data. Tabular numbers keep metrics easy
                to compare.
              </p>
            </Card>
          </div>
        </section>

        <section className="system-section" id="components">
          <div className="system-section-heading">
            <div>
              <p className="section-label">03 / Components</p>
              <h2>Small parts. Shared rules.</h2>
            </div>
            <p>
              Real components,
              <br />
              ready for the workspace.
            </p>
          </div>
          <div className="system-component-grid">
            <Card>
              <h3>Actions</h3>
              <p className="muted">One primary action per task.</p>
              <div className="system-component-row">
                <Button variant="primary" onClick={() => setSaved(true)}>
                  Save record
                </Button>
                <Button variant="secondary" onClick={() => setSaved(false)}>
                  Reset
                </Button>
                <Button disabled>Indexing…</Button>
              </div>
              <div className="system-component-row">
                <Button size="small">Open source</Button>
                <Button
                  variant="danger"
                  size="small"
                  onClick={() => setSaved(false)}
                >
                  Discard draft
                </Button>
              </div>
              {saved && (
                <Alert tone="success">
                  Record saved. This is a component preview.
                </Alert>
              )}
            </Card>
            <Card>
              <h3>Classification & status</h3>
              <p className="muted">Always pair color with a readable label.</p>
              <div className="system-component-row">
                <Badge className="public">Public</Badge>
                <Badge>Internal</Badge>
                <Badge className="confidential">Confidential</Badge>
                <Badge className="restricted">Restricted</Badge>
              </div>
              <div className="system-component-row">
                <Badge tone="success">Ready</Badge>
                <Badge tone="warning">Indexing</Badge>
                <Badge tone="danger">Failed</Badge>
                <Badge tone="info">3 sources</Badge>
              </div>
            </Card>
            <Card>
              <h3>Fields</h3>
              <div className="form">
                <Field
                  label="Record title"
                  hint="Use a name your team will recognize."
                >
                  {(field) => (
                    <Input
                      {...field}
                      placeholder="Supplier onboarding policy"
                    />
                  )}
                </Field>
                <Field label="Classification">
                  {(field) => (
                    <Select {...field} defaultValue="internal">
                      <option value="internal">Internal</option>
                      <option value="public">Public</option>
                      <option value="confidential">Confidential</option>
                      <option value="restricted">Restricted</option>
                    </Select>
                  )}
                </Field>
                <Field label="Document text">
                  {(field) => (
                    <Textarea
                      {...field}
                      placeholder="Paste the original passage…"
                    />
                  )}
                </Field>
                <Field label="Unavailable record" hint="This record is being indexed.">
                  {(field) => <Input {...field} disabled defaultValue="Supplier policy" />}
                </Field>
                <Field label="Work email" error="Enter a valid work email.">
                  {(field) => (
                    <Input {...field} type="email" defaultValue="alisha@" />
                  )}
                </Field>
              </div>
            </Card>
            <Card>
              <h3>Feedback</h3>
              <div className="system-alerts">
                <Alert>Every answer links back to its source.</Alert>
                <Alert tone="success">
                  Knowledge ready. Your records are indexed.
                </Alert>
                <Alert tone="warning">
                  Indexing in progress. Keyword search is available.
                </Alert>
                <Alert tone="danger">
                  Upload failed. Try uploading the file again.
                </Alert>
              </div>
            </Card>
          </div>
        </section>

        <section className="system-section" id="in-context">
          <div className="system-section-heading">
            <div>
              <p className="section-label">04 / In context</p>
              <h2>The answer and its evidence.</h2>
            </div>
            <Badge tone="info">Example content</Badge>
          </div>
          <div className="system-desk-preview">
            <div className="system-answer-preview">
              <p className="section-label">Knowledge desk / Northwind</p>
              <h3>What is our refund policy?</h3>
              <div className="system-component-row">
                <Badge tone="success">Answered</Badge>
                <span className="muted">1 authorized source</span>
              </div>
              <p className="answer">
                Customers may request a refund within 30 days of purchase. The
                original receipt is required, and the item must be in its
                original condition.{" "}
                <button
                  type="button"
                  className="cite-chip"
                  aria-label="Show source 1"
                  onClick={() => setTab("Evidence")}
                >
                  1
                </button>
              </p>
              <button
                type="button"
                className="citation"
                onClick={() => setTab("Evidence")}
              >
                <div className="title">[1] Customer refund policy</div>
                <div className="meta">Customer operations · v2 · internal</div>
              </button>
              <form
                className="composer-box"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (query.trim()) setAsked(true);
                }}
              >
                <Input
                  aria-label="Preview question"
                  placeholder="Ask a follow-up question…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setAsked(false);
                  }}
                />
                <Button
                  variant="primary"
                  type="submit"
                  disabled={!query.trim()}
                >
                  Ask
                </Button>
              </form>
              {asked && (
                <p className="muted" role="status">
                  This is a visual preview. Open the desk to ask questions about
                  your company’s documents.
                </p>
              )}
            </div>
            <div className="system-evidence-preview">
              <div className="row">
                <h3>Source ledger</h3>
                <div className="tabs" aria-label="Source preview">
                  {["Library", "Evidence"].map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={tab === name ? "active" : ""}
                      aria-pressed={tab === name}
                      onClick={() => setTab(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              {tab === "Evidence" ? (
                <>
                  <p className="section-label">Source 01 / Exact passage</p>
                  <Badge>Internal</Badge>
                  <h4>Customer refund policy</h4>
                  <p className="muted">Version 2 · Customer operations</p>
                  <p className="passage">
                    Refund eligibility
                    <br />
                    <br />
                    <mark>
                      Refund requests must be submitted within 30 days of
                      purchase.
                    </mark>{" "}
                    Please include the original receipt. Items must be returned
                    in their original condition.
                  </p>
                </>
              ) : (
                <button
                  className="ticket"
                  type="button"
                  onClick={() => setTab("Evidence")}
                >
                  <div className="title">Customer refund policy ↗</div>
                  <div className="kicker">Customer operations · v2</div>
                </button>
              )}
            </div>
          </div>
          <div className="system-auth-preview">
            <div>
              <p className="section-label">A welcoming first step</p>
              <h3>
                Your company’s knowledge.
                <br />A desk of your own.
              </h3>
              <p>Visible labels, clear feedback, and one next action.</p>
            </div>
            <Card>
              <p className="brand-mark">Sign in</p>
              <h3>Open the desk</h3>
              <div className="form">
                <Field label="Work email">
                  {(field) => (
                    <Input
                      {...field}
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
                    />
                  )}
                </Field>
                <Field label="Password">
                  {(field) => (
                    <Input
                      {...field}
                      type="password"
                      placeholder="Your password"
                      autoComplete="current-password"
                    />
                  )}
                </Field>
                <Link className="btn signal block" href="/">
                  Go to sign in ↗
                </Link>
              </div>
            </Card>
          </div>
        </section>
        <footer className="system-footer">
          <span>Kiro / A considered place for company knowledge.</span>
          <span>Design system v0.1</span>
        </footer>
      </main>
    </div>
  );
}
