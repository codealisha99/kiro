import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

// Compile the pure work metrics into a temp directory and import it as an ES module.
const source = await readFile(new URL("../src/lib/work-metrics.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dir = await mkdtemp(join(tmpdir(), "kiro-work-"));
const file = join(dir, "work-metrics.mjs");
await writeFile(file, output);
const m = await import(pathToFileURL(file).href);

const DAY = 86_400_000;
// Wednesday 2026-11-11 12:00 UTC.
const NOW = Date.UTC(2026, 10, 11, 12);
const task = (over = {}) => ({
  id: "t", status: "TODO", assignee_id: null, remaining_hours: null, due_date: null,
  created_at: new Date(NOW - 30 * DAY).toISOString(), completed_at: null, updated_at: new Date(NOW).toISOString(), ...over,
});

test("summary counts open, overdue, blocked, unassigned and known hours", () => {
  const today = m.todayIso(NOW);
  const tasks = [
    task({ id: "a", status: "DONE", completed_at: new Date(NOW - DAY).toISOString(), remaining_hours: 9 }),
    task({ id: "b", status: "IN_PROGRESS", assignee_id: "u1", remaining_hours: 3, due_date: "2026-11-01" }),
    task({ id: "c", status: "BLOCKED", remaining_hours: null, due_date: "2026-12-01" }),
    task({ id: "d", status: "TODO", assignee_id: "u2", remaining_hours: 2.5 }),
  ];
  const s = m.summarizeTasks(tasks, today);
  assert.equal(s.total, 4);
  assert.equal(s.done, 1);
  assert.equal(s.open, 3);
  assert.equal(s.blocked, 1);
  assert.equal(s.overdue, 1, "done tasks are never overdue; only b is past due");
  assert.equal(s.unassigned, 1, "only c is open without an owner");
  assert.equal(s.missingEstimates, 1);
  assert.equal(s.remainingHours, 5.5, "done tasks do not contribute remaining hours");
  assert.equal(s.progress, 0.25);
});

test("empty task list has no progress ratio", () => {
  assert.equal(m.summarizeTasks([], "2026-11-11").progress, null);
});

test("groups follow the fixed status order and keep empty groups", () => {
  const groups = m.groupByStatus([task({ id: "x", status: "DONE" }), task({ id: "y", status: "TODO" })]);
  assert.deepEqual(groups.map(g => g.status), ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]);
  assert.deepEqual(m.taskOrder([task({ id: "x", status: "DONE" }), task({ id: "y", status: "TODO" })]), ["y", "x"]);
});

test("open work by assignee sorts by count and labels unassigned work", () => {
  const names = { u1: "Ada Lovelace", u2: "Grace Hopper" };
  const items = m.openByAssignee([
    task({ assignee_id: "u1" }), task({ assignee_id: "u1" }), task({ assignee_id: "u2" }),
    task({ assignee_id: null }), task({ assignee_id: "u1", status: "DONE" }),
  ], id => names[id] ?? "Former project member");
  assert.deepEqual(items.map(i => [i.label, i.value]), [["Ada Lovelace", 2], ["Grace Hopper", 1], ["Unassigned", 1]]);
});

test("completions bin into the eight most recent Monday-start weeks", () => {
  const { starts, values } = m.completionsByWeek([
    task({ status: "DONE", completed_at: new Date(NOW).toISOString() }),
    task({ status: "DONE", completed_at: new Date(NOW - 8 * 7 * DAY).toISOString() }),
    task({ status: "DONE", completed_at: new Date(NOW - 2 * DAY).toISOString() }),
  ], NOW);
  assert.equal(starts.length, 8);
  assert.equal(new Date(starts[7]).getUTCDay(), 1, "weeks start on Monday in UTC");
  assert.equal(values[7], 2, "the current week counts both completions made since Monday");
  assert.equal(values.reduce((a, b) => a + b, 0), 2, "completions older than the window are dropped");
});

test("open-over-time counts tasks created before each point and not yet completed", () => {
  const created = new Date(NOW - 20 * DAY).toISOString();
  const tasks = [
    task({ created_at: created, status: "DONE", completed_at: new Date(NOW - 5 * DAY).toISOString() }),
    task({ created_at: created }),
  ];
  const points = m.openTasksOverTime(tasks, NOW);
  assert.equal(points.at(-1).x, NOW);
  assert.equal(points.at(-1).y, 1, "one task remains open now");
  const between = points.filter(p => p.x >= NOW - 20 * DAY && p.x < NOW - 5 * DAY);
  assert.ok(between.length > 0);
  assert.ok(between.every(p => p.y === 2), "both tasks are open between creation and the completion");
});

test("move index clamps at both ends and starts from the edge when nothing is focused", () => {
  assert.equal(m.moveIndex(0, 3, -1), 0);
  assert.equal(m.moveIndex(2, 3, 1), 2);
  assert.equal(m.moveIndex(1, 3, 1), 2);
  assert.equal(m.moveIndex(-1, 3, 1), 0);
  assert.equal(m.moveIndex(-1, 3, -1), 2);
  assert.equal(m.moveIndex(0, 0, 1), -1);
});

test("initials use the first two words and tolerate missing names", () => {
  assert.equal(m.initials("ada lovelace king"), "AL");
  assert.equal(m.initials(null), "?");
  assert.equal(m.initials("  "), "?");
});

test("history payloads parse safely", () => {
  assert.deepEqual(m.parsePayload('{"status":"DONE"}'), { status: "DONE" });
  assert.equal(m.parsePayload("not json"), null);
  assert.equal(m.parsePayload("[1]"), null);
});

test("project summary uses the server's counts and the latest update", () => {
  const summary = m.projectSummary({ updated_at: "2026-11-01T00:00:00Z", task_total: 150, task_done: 120, task_blocked: 3, tasks_updated_at: "2026-11-11T08:00:00Z" });
  assert.equal(summary.updatedAt, "2026-11-11T08:00:00.000Z");
  assert.deepEqual([summary.total, summary.done, summary.blocked, summary.progress], [150, 120, 3, 0.8]);
  const empty = m.projectSummary({ updated_at: "2026-11-01T00:00:00Z", task_total: 0, task_done: 0, task_blocked: 0, tasks_updated_at: null });
  assert.equal(empty.progress, null);
  assert.equal(empty.updatedAt, "2026-11-01T00:00:00.000Z");
});

test("task status segments add up to the total", () => {
  const segments = m.taskStatusSegments({ total_tasks: 23, completed_tasks: 17, blocked_tasks: 1 });
  assert.deepEqual(segments.map((s) => s.value), [17, 5, 1]);
});

test("project completion ranks projects with tasks and skips empty ones", () => {
  const rows = m.projectCompletion([
    { id: "a", name: "Alpha", updated_at: "2026-11-01T00:00:00Z", task_total: 10, task_done: 5, task_blocked: 2, tasks_updated_at: null },
    { id: "b", name: "Beta", updated_at: "2026-11-01T00:00:00Z", task_total: 4, task_done: 4, task_blocked: 0, tasks_updated_at: null },
    { id: "c", name: "Empty", updated_at: "2026-11-01T00:00:00Z", task_total: 0, task_done: 0, task_blocked: 0, tasks_updated_at: null },
  ]);
  assert.deepEqual(rows.map((r) => [r.id, r.value]), [["b", 100], ["a", 50]]);
  assert.equal(rows[1].detail, "5 of 10 done, 2 blocked");
});
