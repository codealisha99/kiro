"use client";

import type { CitationSource, DocumentDetail } from "@company/shared";

export default function EvidencePanel({
  document,
  citation,
  loading,
  onClose,
}: {
  document: DocumentDetail | null;
  citation: CitationSource | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="scroll">
        <p className="spinner">Opening the source…</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="scroll">
        <div className="empty-ask" style={{ margin: "24px 0" }}>
          <h2 style={{ fontSize: 26 }}>The ledger is empty</h2>
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
    : document.content;

  return (
    <div className="scroll">
      <div className="row" style={{ marginBottom: 10 }}>
        <span className={`badge ${document.classification}`}>
          {document.classification}
        </span>
        <button className="btn ghost small" onClick={onClose}>
          Close
        </button>
      </div>
      <h3 style={{ fontSize: 20, letterSpacing: "-0.03em", marginBottom: 6 }}>
        {document.title}
      </h3>
      <p className="muted" style={{ marginBottom: 16 }}>
        {document.filename ?? "Pasted text"} · v{document.versionCount} ·{" "}
        {new Date(document.updatedAt).toLocaleDateString()}
      </p>
      {citation && (
        <p className="muted" style={{ marginBottom: 12 }}>
          Pulled because it supported the answer. Matching lines are marked.
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
