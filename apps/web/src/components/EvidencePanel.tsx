"use client";

import { Badge } from "@/components/ui";
import { WorkspaceIcon } from "./WorkspaceIcon";
import type { CitationSource, DocumentDetail } from "@kiro/shared";

export default function EvidencePanel({
  document,
  citation,
  loading,
}: {
  document: DocumentDetail | null;
  citation: CitationSource | null;
  loading: boolean;
}) {
  if (loading)
    return (
      <div className="source-loading" role="status">
        <WorkspaceIcon name="file" />
        <p>Opening the source…</p>
      </div>
    );
  if (!document)
    return (
      <div className="evidence-empty">
        <h2>No document selected</h2>
        <p>Open a citation or choose a document from your library.</p>
      </div>
    );

  const excerpt = citation?.excerpt?.trim();
  const match = excerpt ? findPassage(document.content, excerpt) : null;
  return (
    <div className="source-reader">
      <div className="source-meta">
        <Badge className={document.classification}>
          {document.classification === "internal"
            ? "Workspace"
            : document.classification === "restricted"
              ? "Only you"
              : document.classification}
        </Badge>
        <span>Version {document.versionCount}</span>
      </div>
      <h3 className="evidence-title">{document.title}</h3>
      <p className="source-file">
        <WorkspaceIcon name="file" />
        {document.filename ?? "Pasted text"}
        <span>
          Updated{" "}
          {new Date(document.updatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </p>
      {excerpt && (
        <section
          className="source-excerpt"
          aria-label="Passage used in this answer"
        >
          <p>
            <WorkspaceIcon name="book" />
            Passage used in this answer
          </p>
          <blockquote>{excerpt}</blockquote>
        </section>
      )}
      <details className="source-full-document" open={!excerpt}>
        <summary>
          Read full document <WorkspaceIcon name="chevron" />
        </summary>
        <div className="passage">
          {match ? (
            <>
              {document.content.slice(0, match.index)}
              <mark>{match[0]}</mark>
              {document.content.slice(match.index + match[0].length)}
            </>
          ) : (
            document.content
          )}
        </div>
      </details>
    </div>
  );
}

function findPassage(content: string, excerpt: string): RegExpExecArray | null {
  // Match the entire cited passage even when the document uses different line breaks.
  const pattern = excerpt
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(pattern, "i").exec(content);
}
