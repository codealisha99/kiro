"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Field, Input, Panel, Section, Select } from "@/components/ui";
import { orgApi, type OrgGraph } from "@/lib/organization-api";

// Bounded relationship browser. Metrics for the same scope live in the dashboard tabs.
export default function OrganizationExplorer() {
  const [graph, setGraph] = useState<OrgGraph | null>(null);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setGraph(null); setSelected("");
    orgApi.graph()
      .then((g) => { if (active) setGraph(g); })
      .catch((e) => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const needle = search.toLowerCase();
  const nodes = graph?.nodes.filter((n) => `${n.name} ${n.type}`.toLowerCase().includes(needle)) ?? [];
  const node = graph?.nodes.find((n) => n.id === selected);
  const related = graph?.edges.filter((e) => e.source === selected || e.target === selected) ?? [];

  return (
    <Section title="Relationship explorer" description="Find an entity, then follow its explicit links to projects, tasks, people, goals, and teams.">
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && <p role="status">Loading authorized relationships…</p>}
      <div className="org-explorer">
        <Panel className="org-explorer-controls">
          <Field label="Find an entity">{(f) => <Input {...f} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Project, task, person or goal" />}</Field>
          <Field label="Entity">{(f) => (
            <Select {...f} value={selected} disabled={loading} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select an entity to explore</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.type})</option>)}
            </Select>
          )}</Field>
          <Button variant="secondary" disabled={loading} onClick={() => setRevision((n) => n + 1)}>Refresh explorer</Button>
        </Panel>
        <Panel className="org-explorer-detail">
          {!graph && !loading && <p className="org-muted">No relationships loaded.</p>}
          {graph && !node && <p className="org-muted">Choose an entity to see its visible relationships.</p>}
          {graph && node && (
            <>
              <h3>{node.name} <span className="org-muted">{node.type}</span></h3>
              {!related.length && <p className="org-muted">No visible relationships for this entity.</p>}
              <ul className="org-list">
                {related.map((e) => {
                  const neighborId = e.source === selected ? e.target : e.source;
                  const neighbor = graph.nodes.find((n) => n.id === neighborId);
                  return (
                    <li key={e.id}>
                      <span>
                        {e.source === selected ? node.name : neighbor?.name} → {e.kind.replaceAll("_", " ").toLowerCase()} → {e.source === selected ? neighbor?.name : node.name}
                        {e.label ? ` · ${e.label}` : ""}
                      </span>
                      <Button variant="secondary" size="small" onClick={() => { setSearch(""); setSelected(neighbor?.id ?? ""); }}>Explore {neighbor?.name}</Button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Panel>
      </div>
      {graph && (
        <details className="org-method">
          <summary>Method and limits</summary>
          <p>{graph.method}</p>
          <p>This is a bounded view: up to 150 projects, tasks and people, 75 goals, initiatives and milestones, and 100 teams and departments. Missing nodes may be outside the limit or your access. Calculated {new Date(graph.generatedAt).toLocaleString()}.</p>
        </details>
      )}
    </Section>
  );
}
