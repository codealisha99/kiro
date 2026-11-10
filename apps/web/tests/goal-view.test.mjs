import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

// Compile the real TypeScript modules into a temp directory so their relative imports resolve.
const dir = await mkdtemp(join(tmpdir(), "kiro-goal-view-"));
async function compile(name) {
  const source = await readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
  await writeFile(join(dir, `${name}.mjs`), output);
  return import(pathToFileURL(join(dir, `${name}.mjs`)).href);
}
await compile("goal-format");
const view = await compile("goal-view");

function goal(overrides) {
  return {
    id: "g", scope: "TEAM", scopeName: "Team", title: "Goal", description: null, ownerId: "u1", ownerName: "Ada",
    departmentId: null, teamId: null, parentId: null, measure: "METRIC", unit: null, startValue: 0, targetValue: 100,
    currentValue: 50, startDate: "2026-01-01", dueDate: "2026-12-31", status: "ACTIVE", progress: 0.5, expected: 0.4,
    health: "ON_TRACK", remaining: 50, taskCount: 0, doneTaskCount: 0, childCount: 0, canEdit: false, mine: false, version: 1,
    ...overrides,
  };
}

test("alignment tree indents children, hides collapsed branches, and keeps context for matches", () => {
  const goals = [
    goal({ id: "co", scope: "COMPANY", title: "Company" }),
    goal({ id: "te", scope: "TEAM", title: "Team", parentId: "co", health: "AT_RISK" }),
    goal({ id: "pe", scope: "PERSON", title: "Me", parentId: "te", mine: true }),
  ];
  const open = view.treeRows(goals, "all", new Set());
  assert.deepEqual(open.map((row) => [row.goal.id, row.depth]), [["co", 0], ["te", 1], ["pe", 2]]);
  const collapsed = view.treeRows(goals, "all", new Set(["te"]));
  assert.deepEqual(collapsed.map((row) => row.goal.id), ["co", "te"]);
  assert.equal(collapsed[1].expanded, false);
  const risk = view.treeRows(goals, "risk", new Set());
  assert.deepEqual(risk.map((row) => [row.goal.id, row.context]), [["co", true], ["te", false]]);
});

test("a goal whose parent is not visible becomes a root", () => {
  const goals = [goal({ id: "pe", scope: "PERSON", parentId: "hidden" })];
  assert.deepEqual(view.treeRows(goals, "all", new Set()).map((row) => row.depth), [0]);
});

test("filters count goals and at-risk includes off track", () => {
  const goals = [
    goal({ id: "a", health: "AT_RISK" }),
    goal({ id: "b", health: "OFF_TRACK", mine: true, scope: "PERSON" }),
    goal({ id: "c", health: "ON_TRACK" }),
  ];
  const counts = view.filterCounts(goals);
  assert.equal(counts.all, 3);
  assert.equal(counts.mine, 1);
  assert.equal(counts.risk, 2);
  assert.equal(counts.PERSON, 1);
});

test("on-track ratio drops cancelled goals and counts achieved as on track", () => {
  const goals = [
    goal({ health: "ON_TRACK" }),
    goal({ health: "ACHIEVED" }),
    goal({ health: "AT_RISK" }),
    goal({ health: "CANCELLED" }),
  ];
  assert.deepEqual(view.onTrackRatio(goals), { onTrack: 2, total: 3 });
});

test("health segments omit empty categories", () => {
  const segments = view.healthSegments([goal({ health: "AT_RISK" }), goal({ health: "AT_RISK" }), goal({ health: "ON_TRACK" })]);
  assert.deepEqual(segments.map((segment) => [segment.label, segment.value]), [["On track", 1], ["At risk", 2]]);
});

test("prioritized goals put the viewer's own first without reordering the input", () => {
  const input = [goal({ id: "co", scope: "COMPANY", title: "B" }), goal({ id: "me", scope: "PERSON", mine: true, title: "A" })];
  const sorted = view.prioritizedGoals(input);
  assert.deepEqual(sorted.map((item) => item.id), ["me", "co"]);
  assert.deepEqual(input.map((item) => item.id), ["co", "me"]);
});

test("metric series start at the start value, sort check-ins, and add an ideal pace to target", () => {
  const checkins = [
    { id: "2", value: 70, created_at: "2026-06-10T09:00:00Z" },
    { id: "1", value: 40, created_at: "2026-03-01T09:00:00Z" },
    { id: "3", value: null, created_at: "2026-07-01T09:00:00Z" },
  ];
  const [actual, ideal] = view.metricSeries(goal({}), checkins);
  assert.equal(actual.id, "actual");
  assert.deepEqual(actual.points.map((point) => point.y), [0, 40, 70]);
  assert.equal(ideal.id, "ideal");
  assert.deepEqual(ideal.points.map((point) => point.y), [0, 100]);
  assert.equal(ideal.points[0].x, Date.UTC(2026, 0, 1));
  assert.equal(ideal.points[1].x, Date.UTC(2026, 11, 31));
});

test("no ideal line without both a start and a target", () => {
  const series = view.metricSeries(goal({ targetValue: null }), []);
  assert.deepEqual(series.map((line) => line.id), ["actual"]);
});

test("keyboard order follows the list groups or the tree", () => {
  const goals = [
    goal({ id: "pe", scope: "PERSON", title: "Me" }),
    goal({ id: "co", scope: "COMPANY", title: "Company" }),
    goal({ id: "ch", scope: "TEAM", title: "Child", parentId: "co" }),
  ];
  const ids = (filter, mode, collapsed) => view.visibleGoalOrder(goals, filter, mode, new Set(collapsed)).map((item) => item.id);
  assert.deepEqual(ids("all", "list", []), ["co", "ch", "pe"]);
  assert.deepEqual(ids("all", "tree", []), ["co", "ch", "pe"]);
  assert.deepEqual(ids("all", "tree", ["co"]), ["co", "pe"]);
  assert.deepEqual(ids("PERSON", "list", []), ["pe"]);
});

test("weekly throughput labels weeks in UTC", () => {
  const result = view.throughputCategories([{ week_start: "2026-09-07", completed: 4 }, { week_start: "2026-09-14", completed: 0 }]);
  assert.deepEqual(result.categories, ["Sep 7", "Sep 14"]);
  assert.deepEqual(result.values, [4, 0]);
});

test("behind pace lists only active, measured goals that are behind, furthest first", () => {
  const rows = view.behindPace([
    goal({ id: "a", title: "A", progress: 0.2, expected: 0.6 }),
    goal({ id: "b", title: "B", progress: 0.5, expected: 0.4 }), // ahead
    goal({ id: "c", title: "C", progress: 0.3, expected: 0.5 }),
    goal({ id: "d", title: "D", progress: null, expected: 0.9 }), // no data
    goal({ id: "e", title: "E", progress: 0.1, expected: 0.9, status: "CANCELLED" }),
  ]);
  assert.deepEqual(rows.map((r) => [r.id, r.value]), [["a", 40], ["c", 20]]);
  assert.equal(rows[0].detail, "20% vs 60% expected");
});

test("progress by scope averages each level and skips levels with nothing measured", () => {
  const levels = view.progressByScope([
    goal({ scope: "COMPANY", progress: 0.4, expected: 0.6 }),
    goal({ scope: "COMPANY", progress: 0.6, expected: 0.6 }),
    goal({ scope: "TEAM", progress: null }),
  ]);
  assert.deepEqual(levels, [{ scope: "COMPANY", count: 2, progress: 50, expected: 60 }]);
});
