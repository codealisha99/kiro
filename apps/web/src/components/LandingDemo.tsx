"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { KiroMark, WorkspaceIcon } from "./WorkspaceIcon";

const examples = [
  {
    label: "A policy",
    question: "What is our refund policy?",
    answer:
      "Customers can request a refund within 30 days of purchase. Ask for their order number and the reason for the request, then send it to the support team for review.",
    document: "Customer support handbook",
    section: "Refunds & returns",
    passage:
      "Refund requests are accepted within 30 days of purchase. Collect the customer's order number and reason for requesting a refund. The support team reviews each request before processing it.",
  },
  {
    label: "A process",
    question: "How do we onboard a new supplier?",
    answer:
      "Start by collecting the supplier’s business details and tax documents. Procurement reviews the submission before finance sets up the supplier for payment.",
    document: "Supplier onboarding guide",
    section: "Getting a supplier approved",
    passage:
      "Collect the supplier's business details and tax documents. Submit the complete packet to procurement for review. After approval, finance creates the supplier's payment record.",
  },
  {
    label: "A handoff",
    question: "What should the next account owner know?",
    answer:
      "The client has approved the revised launch plan. The next account owner should confirm the training date and share the updated checklist before the launch review.",
    document: "Client handoff notes",
    section: "Next steps",
    passage:
      "The revised launch plan has been approved by the client. The new account owner needs to confirm the training date and send the updated checklist ahead of the launch review.",
  },
];

export default function LandingDemo() {
  const [selected, setSelected] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(true);
  const example = examples[selected];

  return (
    <div className="landing-demo" id="product-demo">
      <div className="demo-toolbar">
        <span className="demo-brand">
          <KiroMark /> Ask Kiro
        </span>
        <span className="demo-example">Interactive example</span>
      </div>
      <div className="demo-options" aria-label="Choose an example question">
        {examples.map((item, index) => (
          <Button
            key={item.label}
            variant="secondary"
            aria-pressed={selected === index}
            onClick={() => {
              setSelected(index);
              setSourceOpen(true);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="demo-question">
        <WorkspaceIcon name="message" />
        <h2>{example.question}</h2>
      </div>
      <div className="demo-answer" aria-live="polite" aria-atomic="true">
        <div className="demo-answer-label">
          <WorkspaceIcon name="check" /> From your documents
        </div>
        <p>
          {example.answer}{" "}
          <button
            className="demo-cite"
            aria-label={`Read source: ${example.document}`}
            aria-expanded={sourceOpen}
            aria-controls="demo-source"
            onClick={() => setSourceOpen(!sourceOpen)}
          >
            [1]
          </button>
        </p>
        <Button
          className="demo-source-toggle"
          variant="secondary"
          aria-expanded={sourceOpen}
          aria-controls="demo-source"
          onClick={() => setSourceOpen(!sourceOpen)}
        >
          <WorkspaceIcon name="file" /> {example.document}{" "}
          <span className="demo-source-action">
            {sourceOpen ? "Close source" : "Read source"}
          </span>
        </Button>
        {sourceOpen && (
          <div className="demo-source" id="demo-source">
            <span className="demo-source-heading">[1] {example.section}</span>
            <blockquote>{example.passage}</blockquote>
          </div>
        )}
      </div>
      <div className="demo-footnote">
        <WorkspaceIcon name="lock" /> Illustrative documents. Your workspace
        uses your own sources.
      </div>
    </div>
  );
}
