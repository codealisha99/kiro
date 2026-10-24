"use client";

import { useState } from "react";
import type { DocumentDetail } from "@kiro/shared";
import { Alert, Button, StatefulButton } from "@/components/ui";
import { api, getToken } from "@/lib/api";

export default function DocumentActions({ document, disabled, onDeleted, onOpenVersion, onEdit, onBusyChange }: {
  document: DocumentDetail;
  disabled: boolean;
  onDeleted: (id: string) => void;
  onOpenVersion: (version: number) => void;
  onEdit: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (deleting || disabled) return;
    const session = getToken();
    setDeleting(true);
    onBusyChange(true);
    setError(null);
    try {
      await api.deleteDocument(document.id);
      if (getToken() === session) onDeleted(document.id);
    } catch (err) {
      if (getToken() === session) setError(err instanceof Error ? err.message : "Could not remove this document. Try again.");
    } finally {
      setDeleting(false);
      onBusyChange(false);
    }
  }

  const selectedVersion = document.selectedVersion ?? document.versions[0]?.version;
  const currentVersion = document.versions[0]?.version;

  return (
    <div className="document-management">
      <details className="source-full-document">
        <summary>Version history ({document.versions.length})</summary>
        <ol className="document-versions" aria-label="Document versions">
          {document.versions.map((version, index) => (
            <li key={version.id}>
              <strong>Version {version.version}{index === 0 ? " · Current" : ""}</strong>
              <time dateTime={new Date(version.createdAt).toISOString()}>
                {new Date(version.createdAt).toLocaleString()}
              </time>
              <span>{version.filename ?? "Text"}</span>
              <Button variant="secondary" size="small" disabled={disabled || deleting || selectedVersion === version.version}
                onClick={() => onOpenVersion(version.version)}>
                {selectedVersion === version.version ? `Reading version ${version.version}` : `Read version ${version.version}`}
              </Button>
            </li>
          ))}
        </ol>
        <p className="muted">Earlier versions remain readable under the document’s current access rules.</p>
      </details>
      {document.canEdit && selectedVersion === currentVersion && !confirming && (
        <Button variant="secondary" disabled={disabled || deleting} onClick={onEdit}>Edit document</Button>
      )}
      {selectedVersion !== currentVersion && (
        <Button variant="secondary" disabled={disabled || deleting} onClick={() => { if (currentVersion) onOpenVersion(currentVersion); }}>Read current version</Button>
      )}
      {document.canDelete && (confirming ? (
        <div className="document-removal">
          <Alert tone="warning">
            Remove “{document.title}” from the workspace library? It will no longer be used in new answers. Saved answers that depend on it will become unavailable. This action has no undo in the desk.
          </Alert>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="document-form-actions">
            <Button variant="secondary" disabled={deleting} onClick={() => { setConfirming(false); setError(null); }}>Keep document</Button>
            <StatefulButton variant="danger" loading={deleting} disabled={disabled} onClick={() => void remove()}>
              {deleting ? "Removing…" : "Confirm removal"}
            </StatefulButton>
          </div>
        </div>
      ) : (
        <Button variant="secondary" disabled={disabled} onClick={() => setConfirming(true)}>Remove document…</Button>
      ))}
    </div>
  );
}
