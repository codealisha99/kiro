"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { request } from "@/lib/api";
import { type DataRow } from "@/lib/organization-api";
import { DataTable } from "./OrganizationWorkspace";
type GraphNode = { id: string; type: string; name: string };
type GraphEdge = { id: number; kind: string; source: string; target: string; label?: string };
type Graph = { nodes: GraphNode[]; edges: GraphEdge[]; method: string; generatedAt: string };
type Metrics = { summary: DataRow; weekly: DataRow[]; teams?: DataRow[]; departments?: DataRow[]; people?: DataRow[]; method: string; generatedAt: string };
export default function OrganizationExplorer() {
 const [graph, setGraph] = useState<Graph | null>(null), [metrics, setMetrics] = useState<Metrics | null>(null);
 const [weeks, setWeeks] = useState(8), [selected, setSelected] = useState(""), [search, setSearch] = useState("");
 const [error, setError] = useState(""), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
 useEffect(() => { let active = true; setLoading(true); setError(""); setGraph(null); setMetrics(null);setSelected("");
  Promise.all([request<Graph>("/organization/graph"),request<Metrics>(`/organization/metrics?weeks=${weeks}`)]).then(([g,m]) => { if(active){setGraph(g);setMetrics(m);} }).catch(e => {if(active)setError((e as Error).message);}).finally(() => {if(active)setLoading(false);});
  return () => {active=false;};
 }, [weeks,revision]);
 const nodes = graph?.nodes.filter(n => `${n.name} ${n.type}`.toLowerCase().includes(search.toLowerCase())) ?? [];
 const node = graph?.nodes.find(n => n.id === selected);
 const related = graph?.edges.filter(e => e.source === selected || e.target === selected) ?? [];
 return <section className="org-stack" aria-busy={loading}><h2>Relationships and reporting periods</h2>
  <p>Explore explicit relationships and recorded activity within your current project permissions.</p>
  {error && <Alert tone="danger">{error}</Alert>}{loading && <p role="status">Loading authorized relationships and metrics…</p>}
  <Button variant="secondary" disabled={loading} onClick={() => setRevision(n => n+1)}>Refresh explorer</Button>
  <Field label="Reporting window (ISO weeks)">{f => <Select {...f} value={weeks} disabled={loading} onChange={e => setWeeks(Number(e.target.value))}>{[1,2,4,8,12].map(w => <option value={w} key={w}>{w} weeks</option>)}</Select>}</Field>
  {metrics && <><p>{metrics.method} Calculated {new Date(metrics.generatedAt).toLocaleString()}.</p>
   <DataTable title="Delivery and effort" rows={[metrics.summary]} columns={[["open_tasks","Open tasks"],["completed_window","Completed in window"],["median_cycle_days","Median elapsed days"],["on_time_rate","On-time fraction"],["actual_hours","Recorded hours"],["allocated_hours","Prorated allocation"],["committed_hours","Prorated commitments"]]} />
   <DataTable title="Weekly recorded completions" rows={metrics.weekly} columns={[["week_start","Week starting"],["completed","Completed"]]} />
   {metrics.departments && <DataTable title="Department delivery" rows={metrics.departments} columns={[["name","Department"],["projects","Projects"],["completed_window","Completed in window"],["blocked","Blocked"],["overdue","Overdue"]]} />}
  </>}
  {graph && <><h3>Relationship explorer</h3><p>{graph.method}</p><p>This is a bounded view: up to 150 projects, tasks and people, 75 goals, initiatives and milestones, and 100 teams and departments. Missing nodes may be outside the limit or your access.</p>
   <Field label="Find an entity">{f => <Input {...f} value={search} onChange={e => setSearch(e.target.value)} placeholder="Project, task, person or goal" />}</Field>
   <Field label="Entity">{f => <Select {...f} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select an entity to explore</option>{nodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.type})</option>)}</Select>}</Field>
   {node && <><h4>{node.name}</h4>{!related.length && <p>No visible relationships for this entity.</p>}<ul className="org-list">{related.map(e => {
    const neighbor=graph.nodes.find(n => n.id === (e.source===selected?e.target:e.source));
    return <li key={e.id}><span>{e.source===selected?node.name:neighbor?.name} → {e.kind.replaceAll("_"," ").toLowerCase()} → {e.source===selected?neighbor?.name:node.name}{e.label?` · ${e.label}`:""}</span><Button variant="secondary" onClick={() => {setSearch("");setSelected(neighbor?.id??"");}}>Explore {neighbor?.name}</Button></li>;
   })}</ul></>}
  </>}
 </section>;
}
