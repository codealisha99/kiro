"use client";
import { useState } from "react";
import { Alert, Button, Field, Input, Section, Select } from "@/components/ui";
import { orgApi, type DataRow } from "@/lib/organization-api";
import { workApi, type WorkDetail } from "@/lib/work-api";
import { useAction } from "./use-action";

export function ProjectAccess({ detail, teams, teamsError, reload }: {
  detail: WorkDetail;
  teams: DataRow[];
  teamsError: string;
  reload: () => Promise<void>;
}) {
  const project = detail.project;
  const canManage = !!project.can_manage_access;
  const restrictedDefault = project.restricted ?? true;
  const teamName = teams.find((t) => String(t.id) === project.team_id)?.name;
  const { busy, error, run } = useAction();
  const [grantUser, setGrantUser] = useState("");
  const [grantPermission, setGrantPermission] = useState("READ");
  const visibility = restrictedDefault ? "Restricted: explicit project grants only" : "Shared with the owning team and scoped organizational roles";

  if (!canManage) {
    return (
      <Section title="Access" description="Only the project owner can change the audience or grant access.">
        <p>Owning team: {teamName ?? "No team"}. Visibility: {visibility}.</p>
      </Section>
    );
  }

  return (
    <>
      <Section title="Audience and team" description="Restricted projects use only ownership and explicit project grants. Sharing with organizational scope lets team members read and scoped roles read or write according to their configured permissions.">
        {teamsError && <Alert tone="warning">Teams could not be loaded: {teamsError}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <AudienceForm key={`${project.team_id ?? ""}-${restrictedDefault}`} projectId={project.id} teams={teams} initialTeam={project.team_id ?? ""} initialRestricted={restrictedDefault} busy={busy} run={run} reload={reload} />
      </Section>
      <Section title="Explicit project access" description="Use an existing workspace member’s ID. Organization administrators do not automatically receive access.">
        <form className="work-form" onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await workApi.grant(project.id, grantUser, grantPermission);
            setGrantUser("");
            await reload();
          });
        }}>
          <Field label="Member ID">{(f) => <Input {...f} required value={grantUser} onChange={(e) => setGrantUser(e.target.value)} />}</Field>
          <Field label="Permission">{(f) => <Select {...f} value={grantPermission} onChange={(e) => setGrantPermission(e.target.value)}><option value="READ">Read</option><option value="WRITE">Read and edit</option></Select>}</Field>
          <Button type="submit" disabled={busy}>Grant access</Button>
        </form>
        <ul className="work-plain-list">
          {detail.members.filter((m) => m.id !== project.owner_id).map((m) => (
            <li key={m.id}>
              {m.name ?? m.id}{" "}
              <Button variant="secondary" size="small" disabled={busy} onClick={() => void run(async () => {
                await workApi.grant(project.id, m.id, "READ", true);
                await reload();
              })}>Revoke access</Button>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function AudienceForm({ projectId, teams, initialTeam, initialRestricted, busy, run, reload }: {
  projectId: string;
  teams: DataRow[];
  initialTeam: string;
  initialRestricted: boolean;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [team, setTeam] = useState(initialTeam);
  const [restricted, setRestricted] = useState(initialRestricted);
  return (
    <form className="work-form" onSubmit={(e) => {
      e.preventDefault();
      void run(async () => {
        await orgApi.audience(projectId, team || null, restricted);
        await reload();
      });
    }}>
      <Field label="Owning team">{(f) => (
        <Select {...f} disabled={busy} value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">No team</option>
          {teams.map((t) => <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>)}
        </Select>
      )}</Field>
      <Field label="Project visibility">{(f) => (
        <Select {...f} disabled={busy} value={restricted ? "restricted" : "organization"} onChange={(e) => setRestricted(e.target.value === "restricted")}>
          <option value="restricted">Restricted — explicit project grants only</option>
          <option value="organization">Share with team and scoped organizational roles</option>
        </Select>
      )}</Field>
      <Button type="submit" disabled={busy}>Save project audience</Button>
    </form>
  );
}
