import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

// The landing page's illustrative company must obey the product's real visibility and health rules.
const source = await readFile(new URL("../src/lib/setup-checklist.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dir = await mkdtemp(join(tmpdir(), "kiro-setup-"));
const file = join(dir, "setup-checklist.mjs");
await writeFile(file, output);
const m = await import(pathToFileURL(file).href);

const empty = { documents: 0, readyConnections: 0, teams: 0, people: 1, reportingLines: 0, roleBindings: 0, goals: 0 };

test("a brand-new workspace has every step open, starting with knowledge", () => {
  const p = m.setupProgress(m.setupSteps(empty));
  assert.deepEqual([p.done, p.total, p.complete, p.next.id], [0, 6, false, "knowledge"]);
});

test("steps complete only from real records", () => {
  const steps = m.setupSteps({ ...empty, documents: 3, people: 1, reportingLines: 2, roleBindings: 0 });
  const done = Object.fromEntries(steps.map((s) => [s.id, s.done]));
  assert.equal(done.knowledge, true);
  assert.equal(done.people, false, "the founder alone is not a team");
  assert.equal(done.scope, false, "reporting lines without any role binding leave no one with a wider view");
  assert.equal(m.setupProgress(steps).next.id, "connect");
});

test("everything in place completes the guide", () => {
  const all = { documents: 1, readyConnections: 1, teams: 2, people: 5, reportingLines: 4, roleBindings: 1, goals: 1 };
  assert.equal(m.setupProgress(m.setupSteps(all)).complete, true);
  assert.equal(m.setupProgress(m.setupSteps(all)).next, null);
});

test("the sample documents' demo viewer is not counted as an invited colleague", () => {
  assert.equal(m.realPeople([{ email: "founder@acme.test" }, { email: "viewer@acme-1a2b.demo" }]), 1);
  assert.equal(m.realPeople([{ email: "founder@acme.test" }, { email: "sam@acme.test" }]), 2);
});
