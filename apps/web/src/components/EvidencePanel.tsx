"use client";

import { Alert, Badge } from "@/components/ui";
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
  const currentVersion = document.versions[0]?.version ?? document.versionCount;
  const selectedVersion = document.selectedVersion ?? currentVersion;
  const historical = selectedVersion !== currentVersion;
  const match = excerpt ? findPassage(document.content, excerpt) : null;
  return (
    <div className="source-reader">
      <div className="source-meta">
        <Badge className={document.classification}>
          {document.classification === "internal"
            ? "Workspace"
            : document.classification === "restricted"
              ? "Restricted"
              : document.classification}
        </Badge>
        <span>Version {selectedVersion}{historical ? " · Earlier version" : " · Current"}</span>
      </div>
      <h3 className="evidence-title">{document.title}</h3>
      <p className="source-file">
        <WorkspaceIcon name="file" />
        {document.filename ?? "Text"}
        <span>
          Saved{" "}
          {new Date(document.versionCreatedAt ?? document.updatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </p>
      {historical && (
        <Alert tone="warning">
          You’re reading version {selectedVersion}{citation ? ", used in this answer" : ""}. The current document is version {currentVersion}. New answers use the current approved version.
        </Alert>
      )}
      {excerpt && (
        <section
          className="source-excerpt"
          aria-label="Passage used in this answer"
        >
          <p>
            <WorkspaceIcon name="book" />
            Passage used in this answer{citation ? ` · Version ${citation.version}` : ""}
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
