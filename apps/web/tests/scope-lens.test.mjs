import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

// The landing page's illustrative company must obey the product's real visibility and health rules.
const source = await readFile(new URL("../src/lib/scope-lens.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dir = await mkdtemp(join(tmpdir(), "kiro-lens-"));
const file = join(dir, "scope-lens.mjs");
await writeFile(file, output);
const m = await import(pathToFileURL(file).href);

test("each role sees itself and its reporting subtree", () => {
  assert.equal(m.visiblePeople("ceo").size, m.LENS_PEOPLE.length);
  assert.deepEqual([...m.visiblePeople("manager")].sort(), ["jo", "riley", "sam"]);
  assert.deepEqual([...m.visiblePeople("employee")], ["riley"]);
});

test("goal visibility narrows from CEO to manager to employee", () => {
  const count = (role) => m.LENS_GOALS.filter((g) => g.visibleTo.includes(role)).length;
  assert.deepEqual([count("ceo"), count("manager"), count("employee")], [6, 5, 4]);
  // A manager sees a report's personal goal; another department's goal stays hidden.
  const byId = Object.fromEntries(m.LENS_GOALS.map((g) => [g.id, g]));
  assert.ok(byId.g6.visibleTo.includes("manager"));
  assert.ok(!byId.g3.visibleTo.includes("manager"));
  assert.ok(!byId.g5.visibleTo.includes("employee"));
});

test("health uses the API thresholds: 10 and 25 points behind", () => {
  assert.equal(m.lensHealth({ progress: 0.6, expected: 0.7 }), "On track");
  assert.equal(m.lensHealth({ progress: 0.45, expected: 0.7 }), "At risk");
  assert.equal(m.lensHealth({ progress: 0.44, expected: 0.7 }), "Off track");
  assert.deepEqual(m.LENS_GOALS.map(m.lensHealth), ["On track", "At risk", "On track", "On track", "Off track", "On track"]);
});
