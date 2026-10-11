"use client";

import { Badge } from "@/components/ui";

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
  if (loading) {
    return (
      <div className="scroll">
        <p className="spinner" role="status">
          Opening the source…
        </p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="scroll">
        <div className="evidence-empty">
          <h2>No document selected</h2>
          <p>
            Click a numbered citation in an answer, or open a document from the
            library. The exact passage appears here.
          </p>
        </div>
      </div>
    );
  }

  const needle = citation?.excerpt?.trim();
  const highlighted = needle
    ? highlightPassage(document.content, needle)
    : escapeHtml(document.content);

  return (
    <div className="scroll">
      <div className="row" style={{ marginBottom: 10 }}>
        <Badge className={document.classification}>
          {document.classification}
        </Badge>
      </div>
      <h3 className="evidence-title">{document.title}</h3>
      <p className="muted" style={{ marginBottom: 16 }}>
        {document.filename ?? "Pasted text"} · v{document.versionCount} ·{" "}
        {new Date(document.updatedAt).toLocaleDateString()}
      </p>
      {citation && (
        <p className="muted" style={{ marginBottom: 12 }}>
          The passage used in this answer is highlighted below.
        </p>
      )}
      <div
        className="passage"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}

function highlightPassage(content: string, excerpt: string): string {
  const escaped = escapeHtml(content);
  const needle = excerpt.slice(0, 80).replace(/\s+/g, " ").trim();
  if (!needle) {
    return escaped;
  }
  const idx = escaped.toLowerCase().indexOf(escapeHtml(needle).toLowerCase());
  if (idx < 0) {
    return `${escaped}\n\n<blockquote>${escapeHtml(excerpt)}</blockquote>`;
  }
  const end = idx + escapeHtml(needle).length;
  return `${escaped.slice(0, idx)}<mark>${escaped.slice(idx, end)}</mark>${escaped.slice(end)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
