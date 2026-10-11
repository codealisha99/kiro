"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { DocumentListItem, EmbedStatus, SourceDto } from "@kiro/shared";
import {
  Alert,
  Button,
  Dialog,
  Field,
  FileUpload,
  StatefulButton,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { api } from "@/lib/api";
import { WorkspaceIcon } from "./WorkspaceIcon";

export default function KnowledgeLibrary({
  documents,
  sources,
  embedStatus,
  onOpen,
  onRefresh,
  addRequest = 0,
}: {
  documents: DocumentListItem[];
  sources: SourceDto[];
  embedStatus: EmbedStatus | null;
  onOpen: (id: string) => void;
  onRefresh: () => Promise<void>;
  addRequest?: number;
}) {
  const [access, setAccess] = useState("all");
  const [sort, setSort] = useState("updated");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(addRequest > 0);
  useEffect(() => {
    if (addRequest > 0) setAdding(true);
  }, [addRequest]);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [classification, setClassification] = useState("internal");
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const names = useMemo(
    () => new Map(sources.map((source) => [source.id, source.name])),
    [sources],
  );
  const filtered = documents
    .filter(
      (doc) =>
        `${doc.title} ${names.get(doc.sourceId) ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()) &&
        (access === "all" || doc.classification === access),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || (mode === "file" && !file)) return;
    setSaving(true);
    setError(null);
    try {
      const result =
        mode === "file" && file
          ? await api.uploadDocument(file, {
              title: title.trim() || undefined,
              classification,
            })
          : await api.ingestDocument({
              title: title.trim(),
              content: content.trim(),
              classification,
            });
      setNotice(`“${result.title}” added to your library.`);
      setAdding(false);
      setFile(null);
      setTitle("");
      setContent("");
      setClassification("internal");
      await onRefresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not add the document. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function seed() {
    setSeeding(true);
    setError(null);
    try {
      const result = await api.seedDemo();
      setNotice(`${result.documentCount} sample documents added.`);
      await onRefresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load sample documents.",
      );
    } finally {
      setSeeding(false);
    }
  }

  return (
    <section className="knowledge-library" aria-labelledby="library-title">
      <div className="library-heading">
        <div>
          <h1 id="library-title">Your library</h1>
          <p>
            The knowledge behind your answers. Keep it together, keep it useful.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setError(null);
            setFile(null);
            setAdding(true);
          }}
        >
          <WorkspaceIcon name="plus" />
          Add document
        </Button>
      </div>
      {notice && (
        <p className="library-notice" role="status">
          <WorkspaceIcon name="check" />
          {notice}
        </p>
      )}
      {error && !adding && <Alert tone="danger">{error}</Alert>}
      <div className="library-tools">
        <div className="library-search">
          <WorkspaceIcon name="search" />
          <Input
            aria-label="Search documents"
            placeholder="Find a document…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="library-filters">
          <Select
            aria-label="Filter by document access"
            value={access}
            onChange={(event) => setAccess(event.target.value)}
          >
            <option value="all">All access levels</option>
            <option value="internal">Workspace</option>
            <option value="public">Public within workspace</option>
            <option value="confidential">Confidential</option>
            <option value="restricted">Only you</option>
          </Select>
          <Select
            aria-label="Sort documents"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="updated">Recently updated</option>
            <option value="title">Title A–Z</option>
          </Select>
        </div>
      </div>
      <div className="library-list-heading">
        <span>Documents</span>
        <span className="library-count" role="status">
          {filtered.length === documents.length
            ? `${documents.length} document${documents.length === 1 ? "" : "s"}`
            : `${filtered.length} of ${documents.length} documents`}
        </span>
      </div>
      {embedStatus && embedStatus.totalChunks > 0 && !embedStatus.ready && (
        <p className="library-status" role="status">
          <span className="status-dot" />
          Documents are saved. Search preparation is pending.
        </p>
      )}
      <div className="document-list">
        {filtered.map((doc) => (
          <button
            key={doc.id}
            className="document-row"
            onClick={() => onOpen(doc.id)}
          >
            <span className="document-icon">
              <WorkspaceIcon name="file" />
            </span>
            <span className="document-info">
              <strong>{doc.title}</strong>
              <span>{names.get(doc.sourceId) ?? "Uploaded document"}</span>
            </span>
            <span className={`document-access ${doc.classification}`}>
              <WorkspaceIcon name="lock" />
              {doc.classification === "internal"
                ? "Workspace"
                : doc.classification === "restricted"
                  ? "Only you"
                  : doc.classification === "confidential"
                    ? "Confidential"
                    : "Public"}
            </span>
            <span className="document-updated">
              {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
            <WorkspaceIcon name="chevron" className="document-chevron" />
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="library-empty">
            <WorkspaceIcon name="book" width="32" height="32" />
            <h2>
              {documents.length
                ? "No matching documents"
                : "A place for what your team knows"}
            </h2>
            <p>
              {documents.length
                ? "Try a different search or access level."
                : "Add a policy, a project brief, or a useful piece of context."}
            </p>
            {!!documents.length && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setAccess("all");
                }}
              >
                Clear filters
              </Button>
            )}
            {!documents.length && (
              <Button
                variant="secondary"
                disabled={seeding}
                onClick={() => void seed()}
              >
                {seeding ? "Adding samples…" : "Try with sample documents"}
              </Button>
            )}
          </div>
        )}
      </div>
      {documents.length > 0 && (
        <p className="library-footnote">
          <WorkspaceIcon name="lock" />
          Only documents you have access to appear here.
        </p>
      )}
      <Dialog
        open={adding}
        title="Add a document"
        onClose={() => {
          if (!saving) setAdding(false);
        }}
      >
        <form
          className="form document-form"
          onSubmit={(event) => void submit(event)}
        >
          <div className="document-mode" aria-label="Document format">
            <button
              type="button"
              disabled={saving}
              aria-pressed={mode === "file"}
              onClick={() => {
                setMode("file");
                setFile(null);
                setError(null);
              }}
            >
              <WorkspaceIcon name="upload" />
              Upload file
            </button>
            <button
              type="button"
              disabled={saving}
              aria-pressed={mode === "text"}
              onClick={() => {
                setMode("text");
                setError(null);
              }}
            >
              <WorkspaceIcon name="file" />
              Paste text
            </button>
          </div>
          {mode === "file" && (
            <FileUpload
              key={adding ? "open" : "closed"}
              file={file}
              onChange={setFile}
              disabled={saving}
            />
          )}
          <Field label={mode === "file" ? "Title (optional)" : "Title"}>
            {(field) => (
              <Input
                {...field}
                placeholder={file?.name ?? "e.g. Customer refund policy"}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required={mode === "text"}
              />
            )}
          </Field>
          {mode === "text" && (
            <Field label="Document text">
              {(field) => (
                <Textarea
                  {...field}
                  placeholder="Paste the content you want your team to find…"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  required
                  rows={6}
                />
              )}
            </Field>
          )}
          <Field
            label="Who can access this?"
            hint="All access levels stay within your workspace. Public does not publish a document on the internet."
          >
            {(field) => (
              <Select
                {...field}
                value={classification}
                onChange={(event) => setClassification(event.target.value)}
              >
                <option value="internal">Everyone in your workspace</option>
                <option value="public">Public within workspace</option>
                <option value="confidential">
                  Managers and administrators
                </option>
                <option value="restricted">Only you</option>
              </Select>
            )}
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="document-form-actions">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
            <StatefulButton
              loading={saving}
              variant="primary"
              type="submit"
              disabled={saving || (mode === "file" && !file)}
            >
              {saving ? "Adding document…" : "Add to library"}
            </StatefulButton>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
