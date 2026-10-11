import type { Metadata } from "next";
import Link from "next/link";
import LandingDemo from "@/components/LandingDemo";
import { KiroMark, WorkspaceIcon } from "@/components/WorkspaceIcon";
import "./landing.css";

export const metadata: Metadata = {
  title: "Kiro — Your company knowledge, with the source",
  description:
    "Turn your company documents into a shared knowledge desk. Ask a question, find an answer, and read the source with Kiro.",
  openGraph: {
    title: "Kiro — Your company knows. Now you can, too.",
    description:
      "A shared knowledge desk for your team. Ask questions of your documents and follow every answer back to its source.",
    type: "website",
  },
};

const steps = [
  {
    title: "Bring the knowledge together.",
    description:
      "Upload the handbooks, process guides, and project notes your team already uses. Give them a home in one searchable library.",
    icon: "upload" as const,
  },
  {
    title: "Ask it like you’d ask a colleague.",
    description:
      "What’s the policy? How does this work? Where did we leave things? Start with a question, without remembering the right file name.",
    icon: "message" as const,
  },
  {
    title: "Read the answer. Check the source.",
    description:
      "Open a citation to see the passage behind the answer. Keep the context close, so you can decide what to do next.",
    icon: "book" as const,
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
          <a href="#why-kiro">Why Kiro</a>
          <Link href="/app">Sign in</Link>
        </nav>
        <Link className="btn signal" href="/app?mode=register">
          Create a workspace <WorkspaceIcon name="chevron" />
        </Link>
      </header>
      <main id="main">
        <section
          className="landing-hero landing-container"
          aria-labelledby="hero-title"
        >
          <div className="hero-copy">
            <p className="hero-intro">
              <span aria-hidden="true" /> The company knowledge desk
            </p>
            <h1 id="hero-title">
              Your company knows.
              <br />
              Now you can, too.
            </h1>
            <p className="hero-description">
              The answer is somewhere in your documents. Kiro brings it to you,
              with the source right beside it.
            </p>
            <div className="hero-actions">
              <Link className="btn signal" href="/app?mode=register">
                Create your workspace <WorkspaceIcon name="chevron" />
              </Link>
              <a className="hero-demo-link" href="#product-demo">
                Try the example <span aria-hidden="true">↘</span>
              </a>
            </div>
            <p className="hero-note">
              Your documents. Your team. A little less searching.
            </p>
          </div>
          <LandingDemo />
        </section>
        <div className="landing-context landing-container">
          <span>Made for the questions that keep coming up.</span>
          <div>
            <span>Company policies</span>
            <span>Team processes</span>
            <span>Client context</span>
            <span>Project handoffs</span>
          </div>
        </div>
        <section
          className="landing-workflow landing-container"
          id="how-it-works"
          aria-labelledby="workflow-title"
        >
          <div className="workflow-intro">
            <p className="landing-section-note">From a folder to an answer</p>
            <h2 id="workflow-title">
              Less digging.
              <br />
              More knowing.
            </h2>
            <p>
              Keep the knowledge you’ve already written. Make it easier for
              everyone to use.
            </p>
            <div
              className="document-stack"
              aria-label="Supported document types"
            >
              <div>
                <WorkspaceIcon name="file" />
                <span>Employee handbook</span>
                <small>PDF</small>
              </div>
              <div>
                <WorkspaceIcon name="file" />
                <span>Supplier onboarding</span>
                <small>DOCX</small>
              </div>
              <div>
                <WorkspaceIcon name="file" />
                <span>Project handoff notes</span>
                <small>Markdown</small>
              </div>
            </div>
            <p className="file-formats">
              PDF, DOCX, XLSX, CSV, Markdown, and text.
            </p>
          </div>
          <ol className="workflow-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="workflow-number">0{index + 1}</span>
                <div>
                  <WorkspaceIcon name={step.icon} />
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section
          className="landing-trust"
          id="why-kiro"
          aria-labelledby="trust-title"
        >
          <div className="landing-container trust-grid">
            <div>
              <p className="landing-section-note">Built around the evidence</p>
              <h2 id="trust-title">
                Good answers have
                <br />a paper trail.
              </h2>
              <p className="trust-description">
                An answer is only useful when you can understand where it came
                from. Kiro keeps the original material within reach.
              </p>
              <Link href="/app" className="trust-link">
                Open your knowledge desk <WorkspaceIcon name="chevron" />
              </Link>
            </div>
            <div className="trust-details">
              <article>
                <WorkspaceIcon name="book" />
                <div>
                  <h3>Sources you can actually read</h3>
                  <p>
                    Follow a citation to the original passage and open the
                    document for the full picture.
                  </p>
                </div>
              </article>
              <article>
                <WorkspaceIcon name="shield" />
                <div>
                  <h3>Access stays with the document</h3>
                  <p>
                    Answers use the documents a person is allowed to see. Your
                    workspace’s knowledge stays within your workspace.
                  </p>
                </div>
              </article>
              <article>
                <WorkspaceIcon name="search" />
                <div>
                  <h3>Room for “we don’t know”</h3>
                  <p>
                    When the available documents don’t support an answer, Kiro
                    says so. Your team can add the missing knowledge.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section
          className="landing-faq landing-container"
          aria-labelledby="faq-title"
        >
          <div>
            <p className="landing-section-note">A few things to know</p>
            <h2 id="faq-title">
              Before you
              <br />
              open the desk.
            </h2>
          </div>
          <div className="faq-items">
            <details>
              <summary>
                What can I add to Kiro?<span aria-hidden="true">+</span>
              </summary>
              <p>
                Upload PDF, DOCX, XLSX, CSV, Markdown, or text files up to 10
                MB. You can also paste text directly. Start with a handbook, a
                process guide, or a set of project notes.
              </p>
            </details>
            <details>
              <summary>
                Can I try it before adding documents?
                <span aria-hidden="true">+</span>
              </summary>
              <p>
                Yes. Create a workspace and load the sample documents to explore
                questions, answers, and citations. The example above is
                illustrative and doesn’t access private company information.
              </p>
            </details>
            <details>
              <summary>
                Who can see my company’s knowledge?
                <span aria-hidden="true">+</span>
              </summary>
              <p>
                Each workspace keeps its documents separate. Within a workspace,
                document permissions determine which sources a person can
                retrieve and use in answers.
              </p>
            </details>
            <details>
              <summary>
                Does every question get an answer?
                <span aria-hidden="true">+</span>
              </summary>
              <p>
                Kiro works from the documents available to you. If there isn’t
                enough evidence, it tells you. Source-backed search and excerpts
                are available now; AI-generated answers and semantic search
                require an AI provider to be configured.
              </p>
            </details>
          </div>
        </section>
        <section className="landing-closing landing-container">
          <div className="closing-mark">
            <KiroMark />
          </div>
          <h2>
            Your next answer
            <br />
            is already in there.
          </h2>
          <p>Give your company knowledge a place to be useful.</p>
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
        <span>© {new Date().getFullYear()} Kiro</span>
      </footer>
    </div>
  );
}
