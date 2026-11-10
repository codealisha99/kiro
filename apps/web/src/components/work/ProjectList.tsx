"use client";
import { useState, type FormEvent } from "react";
import { Badge, Button, Field, Input } from "@/components/ui";
import type { WorkProject } from "@/lib/work-api";
import type { ProjectSummary } from "@/lib/work-metrics";

type Props = {
  projects: WorkProject[];
  summaries: Record<string, ProjectSummary>;
  teamNames: Record<string, string>;
  selectedId: string | null;
  unread: number;
  offset: number;
  loading: boolean;
  busy: boolean;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => Promise<boolean>;
  onPage: (delta: number) => void;
  onRefresh: () => void;
};

// Left pane: workspace overview, search, the project list with progress, and the create form.
export function ProjectList({ projects, summaries, teamNames, selectedId, unread, offset, loading, busy, onSelect, onCreate, onPage, onRefresh }: Props) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = projects.filter((p) => p.name.toLowerCase().includes(needle));

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onCreate(name.trim())) setName("");
  }

  return (
    <>
      <div className="work-list-head">
        <h2>Projects</h2>
        {selectedId !== null && <Button variant="secondary" size="small" disabled={busy} onClick={onRefresh}>Refresh</Button>}
      </div>
      <button type="button" className={`work-workspace-item${selectedId === null ? " is-selected" : ""}`} aria-current={selectedId === null ? "true" : undefined} onClick={() => onSelect(null)}>
        Workspace overview
        {unread > 0 && <Badge tone="info">{unread} new</Badge>}
      </button>
      <Field label="Search projects">{(f) => <Input {...f} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />}</Field>
      <form className="work-create" onSubmit={(e) => void create(e)}>
        <Field label="New project name">{(f) => <Input {...f} required maxLength={200} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />}</Field>
        <Button type="submit" size="small" disabled={busy || !name.trim()}>Create project</Button>
      </form>
      {!loading && !projects.length && <p className="work-muted">No projects on this page. Create one or ask its owner for access.</p>}
      {!loading && projects.length > 0 && !visible.length && <p className="work-muted">No projects match “{query.trim()}” on this page.</p>}
      <div data-nav-scope="projects">
        <ul className="work-project-list">
          {visible.map((p) => {
            const summary = summaries[p.id];
            const selected = selectedId === p.id;
            return (
              <li key={p.id}>
                <button type="button" className={`work-project-row${selected ? " is-selected" : ""}`} data-nav-row data-row-id={p.id} aria-current={selected ? "true" : undefined} onClick={() => onSelect(p.id)}>
                  <span className="work-project-name">{p.name}</span>
                  <span className="work-project-meta">
                    {p.team_id ? (teamNames[p.team_id] ?? "Team") : "No team"}
                    {p.restricted !== false && <Badge tone="neutral">Restricted</Badge>}
                  </span>
                  {summary ? (
                    <span className="work-project-progress">
                      <span className="work-meter" aria-hidden="true"><span style={{ width: `${Math.round((summary.stats.progress ?? 0) * 100)}%` }} /></span>
                      <span>{summary.stats.done} of {summary.stats.total} done</span>
                      {summary.stats.blocked > 0 && <span className="work-danger">{summary.stats.blocked} blocked</span>}
                      {summary.updatedAt && <span className="work-muted">Updated {new Date(summary.updatedAt).toLocaleDateString()}</span>}
                    </span>
                  ) : <span className="work-muted">Progress unavailable</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="work-actions">
        <Button variant="secondary" size="small" disabled={busy || loading || !offset} onClick={() => onPage(-100)}>Previous</Button>
        <Button variant="secondary" size="small" disabled={busy || loading || projects.length < 100} onClick={() => onPage(100)}>Next</Button>
      </div>
    </>
  );
}
