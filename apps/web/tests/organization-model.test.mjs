import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

async function load(path) {
  const source = await readFile(new URL(`../src/lib/${path}.ts`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dir = await mkdtemp(join(tmpdir(), `kiro-${path}-`));
  const file = join(dir, `${path}.mjs`);
  await writeFile(file, output);
  return import(pathToFileURL(file).href);
}

const model = await load("organization-model");
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-10T12:00:00Z");

test("company tabs follow granted views and management rights", () => {
  assert.deepEqual(model.visibleOrgTabs({ views: ["EMPLOYEE"], canManage: false, canManageIntegrations: false }), ["overview", "explorer"]);
  assert.deepEqual(
    model.visibleOrgTabs({ views: ["EMPLOYEE", "MANAGER"], canManage: false, canManageIntegrations: true }),
    ["overview", "teams", "people", "explorer", "connections"],
  );
  assert.deepEqual(
    model.visibleOrgTabs({ views: ["EMPLOYEE", "CEO"], canManage: true, canManageIntegrations: true }),
    ["overview", "teams", "explorer", "connections", "setup"],
  );
});

test("a hidden tab falls back to the overview instead of rendering nothing", () => {
  const visible = ["overview", "explorer"];
  assert.equal(model.resolveOrgTab("connections", visible), "overview");
  assert.equal(model.resolveOrgTab("explorer", visible), "explorer");
});

test("numeric reads accept numbers and numeric strings but never invent values", () => {
  assert.equal(model.numberOf({ a: 4 }, "a"), 4);
  assert.equal(model.numberOf({ a: "2.5" }, "a"), 2.5);
  assert.equal(model.numberOf({ a: null }, "a"), null);
  assert.equal(model.numberOf({ a: "" }, "a"), null);
  assert.equal(model.numberOf({ a: "n/a" }, "a"), null);
  assert.equal(model.numberOf(undefined, "a"), null);
});

test("weekly rows parse date-only week starts as UTC", () => {
  assert.equal(model.weekEpoch("2026-10-05"), Date.parse("2026-10-05T00:00:00Z"));
  assert.equal(model.weekEpoch(null), null);
});

test("rankings sort by value descending, keep unknown values last, and do not mutate input", () => {
  const rows = [
    { id: "a", name: "Ops", completed_window: 2, open_tasks: 1 },
    { id: "b", name: "Design", completed_window: null, open_tasks: 0 },
    { id: "c", name: "Eng", completed_window: 7, open_tasks: 3 },
  ];
  const ranked = model.rankByValue(rows, "completed_window");
  assert.deepEqual(ranked.map((item) => item.label), ["Eng", "Ops", "Design"]);
  assert.equal(ranked[2].value, null);
  assert.deepEqual(rows.map((row) => row.id), ["a", "b", "c"]);
});

test("connection status always carries a text label and a tone", () => {
  assert.deepEqual(model.connectionStatus("READY"), { label: "Ready", tone: "success" });
  assert.equal(model.connectionStatus("FAILED").tone, "danger");
  assert.equal(model.connectionStatus("OAUTH_TENANT").label, "Choose an organization");
  assert.equal(model.connectionStatus("SOMETHING_NEW").label, "something new");
});

test("freshness: never synced, fresh, and stale after 24 hours", () => {
  assert.equal(model.syncFreshness(null, NOW).tone, "neutral");
  const fresh = model.syncFreshness(new Date(NOW - 3 * 60 * 60 * 1000).toISOString(), NOW);
  assert.equal(fresh.tone, "success");
  assert.match(fresh.text, /3 hours ago/);
  const stale = model.syncFreshness(new Date(NOW - 2 * DAY).toISOString(), NOW);
  assert.equal(stale.tone, "warning");
  assert.match(stale.text, /withheld/);
});

test("relative time picks readable units", () => {
  assert.equal(model.relativeTime(NOW - 30 * 1000, NOW), "just now");
  assert.equal(model.relativeTime(NOW - 60 * 60 * 1000, NOW), "1 hour ago");
  assert.equal(model.relativeTime(NOW - 5 * DAY, NOW), "5 days ago");
});
