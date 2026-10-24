"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { FormEvent } from "react";
import type { DocumentDetail } from "@kiro/shared";
import { Alert, Button, Field, Input, StatefulButton, Textarea } from "@/components/ui";
import { api, ApiError, getToken } from "@/lib/api";

export interface DocumentEditorHandle {
  requestClose: () => void;
}

export default forwardRef<DocumentEditorHandle, {
  document: DocumentDetail;
  onCancel: () => void;
  onSaved: (document: DocumentDetail) => void;
  onBusyChange: (busy: boolean) => void;
}>(function DocumentEditor({ document, onCancel, onSaved, onBusyChange }, ref) {
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<DocumentDetail | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = title !== document.title || content !== document.content;
  const [version, setVersion] = useState(
    document.selectedVersion ?? document.versions[0]?.version ?? document.versionCount,
  );

  function requestClose() {
    if (saving) return;
    if (changed) setDiscarding(true);
    else onCancel();
  }
  useImperativeHandle(ref, () => ({ requestClose }));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || conflict) return;
    if (!title.trim() || !content.trim()) {
      setError("Enter a title and document text; spaces alone aren’t enough.");
      return;
    }
    const session = getToken();
    setSaving(true);
    onBusyChange(true);
    setError(null);
    try {
      const result = await api.updateDocument(document.id, {
        title: title.trim(), content: content.trim(), expectedVersion: version,
      });
      if (getToken() === session) onSaved(result);
    } catch (err) {
      if (getToken() !== session) return;
      setConflict(err instanceof ApiError && err.status === 409);
      setLatest(null);
      setError(err instanceof Error ? err.message : "Could not save this revision. Your draft is still here.");
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  async function reviewLatest() {
    if (reviewing) return;
    const session = getToken();
    setReviewing(true);
    try {
      const result = await api.document(document.id);
      if (getToken() === session) setLatest(result);
    } catch (err) {
      if (getToken() === session) setError(err instanceof Error ? err.message : "Could not load the current version. Your draft is still here.");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <form className="form document-editor" onSubmit={(event) => void save(event)}>
      <p className="muted">
        Editing version {version}. Saving creates a new version and keeps earlier
        evidence available. Document access stays the same.
        {document.filename ? " You’re editing the extracted text; the original file is preserved in its earlier version." : ""}
      </p>
      <Field label="Document title">
        {(field) => <Input {...field} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required disabled={saving} />}
      </Field>
      <Field label="Document text" hint="Up to 400,000 characters.">
        {(field) => <Textarea {...field} value={content} onChange={(event) => setContent(event.target.value)} maxLength={400_000} rows={12} required disabled={saving} />}
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      {conflict && (
        <div className="document-conflict">
          <p className="muted">Your draft is preserved above. Review the latest version and reconcile any changes in your draft before continuing.</p>
          {latest ? (
            <>
              <h3>Current version {latest.selectedVersion}: {latest.title}</h3>
              <div className="revision-comparison passage" tabIndex={0} aria-label="Current version text">{latest.content}</div>
              <p className="muted">Continuing keeps your draft. Saving will replace the current text with your reconciled draft and preserve the earlier versions.</p>
              <Button variant="secondary" onClick={() => {
                setVersion(latest.selectedVersion ?? latest.versions[0].version);
                setConflict(false);
                setError(null);
                setLatest(null);
              }}>Continue from version {latest.selectedVersion}</Button>
            </>
          ) : (
            <StatefulButton variant="secondary" loading={reviewing} onClick={() => void reviewLatest()}>
              {reviewing ? "Loading current version…" : "Review current version"}
            </StatefulButton>
          )}
        </div>
      )}
      {discarding ? (
        <div className="document-discard">
          <Alert tone="warning">Discard your unsaved changes?</Alert>
          <div className="document-form-actions">
            <Button variant="secondary" onClick={() => setDiscarding(false)}>Keep editing</Button>
            <Button variant="danger" onClick={onCancel}>Discard changes</Button>
          </div>
        </div>
      ) : (
        <div className="document-form-actions">
          <Button variant="secondary" disabled={saving} onClick={requestClose}>Cancel editing</Button>
          <StatefulButton variant="primary" type="submit" loading={saving} disabled={!changed || conflict}>
            {saving ? "Saving revision…" : "Save new version"}
          </StatefulButton>
        </div>
      )}
    </form>
  );
});
