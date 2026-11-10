import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

// The landing page's illustrative company must obey the product's real visibility and health rules.
const source = await readFile(new URL("../src/lib/admin-view.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dir = await mkdtemp(join(tmpdir(), "kiro-admin-"));
const file = join(dir, "admin-view.mjs");
await writeFile(file, output);
const m = await import(pathToFileURL(file).href);

const NOW = Date.UTC(2026, 10, 10, 15);
const ev = (action, iso) => ({ id: iso + action, userId: "u", action, resource: null, query: null, permissionDecision: null, error: null, createdAt: iso });

test("questions per day buckets answered and failed by UTC day and ignores older events", () => {
  const r = m.questionsPerDay([
    ev("query.completed", "2026-11-10T09:00:00Z"),
    ev("query.completed", "2026-11-10T23:59:00Z"),
    ev("query.failed", "2026-11-09T01:00:00Z"),
    ev("query.received", "2026-11-10T09:00:00Z"), // not an outcome
    ev("query.completed", "2026-10-01T00:00:00Z"), // outside the window
  ], 3, NOW);
  assert.deepEqual(r.answered, [0, 0, 2]);
  assert.deepEqual(r.failed, [0, 1, 0]);
  assert.equal(r.dayStarts[2], Date.UTC(2026, 10, 10));
});

test("feedback segments and search readiness", () => {
  assert.deepEqual(m.feedbackSegments([{ helpful: true, _count: 8 }, { helpful: false, _count: 2 }]).map((s) => s.value), [8, 2]);
  assert.equal(m.searchReadiness(0, 0), null);
  assert.equal(m.searchReadiness(10, 7), 0.7);
  assert.equal(m.actionLabel("query.failed"), "Failed");
});

test("permission decisions read as words", () => {
  assert.equal(m.decisionLabel("allowed:no_evidence"), "Allowed · no evidence");
  assert.equal(m.decisionLabel("denied"), "Denied");
  assert.equal(m.decisionLabel(null), "Not recorded");
});
