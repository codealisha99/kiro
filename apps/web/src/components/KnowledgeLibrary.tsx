"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { DocumentListItem, EmbedStatus, SourceDto } from "@kiro/shared";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  Field,
  FileUpload,
  Input,
  PageHeader,
  StatefulButton,
  Select,
  Textarea,
} from "@/components/ui";
import { api } from "@/lib/api";
import {
  ACCESS_FILTERS,
  accessCounts,
  accessLabel,
  accessTone,
  documentStatusLabel,
  documentStatusTone,
  filterDocuments,
  sortDocuments,
  type AccessFilter,
  type LibrarySort,
} from "@/lib/library-model";
import { WorkspaceIcon } from "./WorkspaceIcon";
import "./knowledge-library.css";

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
  const [access, setAccess] = useState<AccessFilter>("all");
  const [sort, setSort] = useState<LibrarySort>("updated");
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
  const counts = useMemo(() => accessCounts(documents), [documents]);
  const filtered = useMemo(
    () => sortDocuments(filterDocuments(documents, names, { search, access }), sort),
    [documents, names, search, access, sort],
  );
  const filtersActive = search.trim() !== "" || access !== "all";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || (mode === "file" && !file)) return;
    if (mode === "text" && (!title.trim() || !content.trim())) {
      setError("Enter a title and document text; spaces alone aren’t enough.");
      return;
    }
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
      setNotice(result.created
        ? `“${result.title}” added to your library.`
        : result.contentChanged
          ? `“${result.title}” updated to version ${result.version}.`
          : `“${result.title}” is already up to date.`);
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
    if (seeding) return;
    setSeeding(true);
    setError(null);
    try {
      const result = await api.seedDemo();
      setNotice(result.seeded
        ? `${result.documentCount} sample documents are ready to explore.`
        : "Sample documents are already in your library.");
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
      <PageHeader
        id="library-title"
        title="Your library"
        subtitle="The knowledge behind your answers. Keep it together, keep it useful."
        actions={
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
        }
      />
      {notice && (
        <p className="library-notice" role="status">
          <WorkspaceIcon name="check" />
          {notice}
        </p>
      )}
      {error && !adding && <Alert tone="danger">{error}</Alert>}

      <div className="library-toolbar">
        <div className="library-search">
          <WorkspaceIcon name="search" />
          <Input
            aria-label="Search documents"
            placeholder="Search by title or source"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="library-chips" role="group" aria-label="Filter by access">
          {ACCESS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className="library-chip"
              aria-pressed={access === filter.id}
              onClick={() => setAccess(filter.id)}
            >
              {filter.label}
              <span className="library-chip-count">{counts[filter.id]}</span>
            </button>
          ))}
        </div>
        <Select
          aria-label="Sort documents"
          className="library-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as LibrarySort)}
        >
          <option value="updated">Recently updated</option>
          <option value="title">Title A–Z</option>
        </Select>
      </div>
      <p className="library-count" role="status">
        {filtered.length === documents.length
          ? `${documents.length} document${documents.length === 1 ? "" : "s"}`
          : `${filtered.length} of ${documents.length} documents`}
      </p>
      {embedStatus && embedStatus.totalChunks > 0 && !embedStatus.ready && (
        <p className="library-status-note" role="status">
          <span className="status-dot" />
          Documents are saved. Search preparation is pending.
        </p>
      )}

      {filtered.length > 0 ? (
        <div className="library-table-wrap">
          <table className="library-table" aria-label="Documents">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col" className="col-optional">Source</th>
                <th scope="col">Access</th>
                <th scope="col">Status</th>
                <th scope="col" className="col-optional is-numeric">Versions</th>
                <th scope="col" className="is-numeric">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <button type="button" className="library-title" onClick={() => onOpen(doc.id)}>
                      <span className="library-doc-icon" aria-hidden="true">
                        <WorkspaceIcon name="file" />
                      </span>
                      <span>{doc.title}</span>
                    </button>
                  </td>
                  <td className="col-optional library-muted">{names.get(doc.sourceId) ?? "Uploaded document"}</td>
                  <td>
                    <Badge tone={accessTone(doc.classification)}>{accessLabel(doc.classification)}</Badge>
                  </td>
                  <td>
                    <span className={`library-status tone-${documentStatusTone(doc.status)}`}>
                      <span className="library-status-dot" aria-hidden="true" />
                      {documentStatusLabel(doc.status)}
                    </span>
                  </td>
                  <td className="col-optional is-numeric">{doc.versionCount}</td>
                  <td className="is-numeric library-muted">
                    {new Date(doc.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
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
          {filtersActive && (
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
      {documents.length > 0 && (
        <p className="library-footnote">
          <WorkspaceIcon name="lock" />
          Only documents you have access to appear here.
        </p>
      )}
      <Dialog
        open={adding}
        closeDisabled={saving}
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
                disabled={saving}
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
                  disabled={saving}
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
                disabled={saving}
                value={classification}
                onChange={(event) => setClassification(event.target.value)}
              >
                <option value="internal">Everyone in your workspace</option>
                <option value="public">Public within workspace</option>
                <option value="confidential">
                  Managers and administrators
                </option>
                <option value="restricted">Only you (restricted)</option>
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
