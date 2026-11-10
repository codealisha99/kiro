import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, test } from "node:test";
import ts from "typescript";

// Compile the real TypeScript modules into a temp directory so their relative imports resolve.
const dir = await mkdtemp(join(tmpdir(), "kiro-home-"));
async function compile(name) {
  const source = await readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
  await writeFile(join(dir, `${name}.mjs`), output);
  return import(pathToFileURL(join(dir, `${name}.mjs`)).href);
}
const { ApiError } = await compile("api");
const { homeApi } = await compile("home-api");
const format = await compile("goal-format");
const draft = await compile("goal-draft");

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
let calls;
let nextResponse;

beforeEach(() => {
  const store = new Map([["kiro-token", "session"]]);
  globalThis.window = {
    localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) },
    dispatchEvent: () => true,
  };
  calls = [];
  nextResponse = { status: 200, body: {} };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    return new Response(JSON.stringify(nextResponse.body), { status: nextResponse.status, headers: { "Content-Type": "application/json" } });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
});

test("home client reads the dashboard with the session token", async () => {
  nextResponse = { status: 200, body: { me: { name: "Ada" }, goals: [] } };
  const home = await homeApi.home();
  assert.equal(home.me.name, "Ada");
  assert.equal(calls[0].method, "GET");
  assert.match(calls[0].url, /\/home$/);
  assert.equal(calls[0].headers.Authorization, "Bearer session");
});

test("goal writes send JSON bodies to the contract paths", async () => {
  await homeApi.createGoal({ scope: "COMPANY", title: "Grow" });
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].url, /\/goals$/);
  assert.deepEqual(calls[0].body, { scope: "COMPANY", title: "Grow" });

  await homeApi.updateGoal("g/1", { expectedVersion: 3, title: "Grow" });
  assert.equal(calls[1].method, "PUT");
  assert.match(calls[1].url, /\/goals\/g%2F1$/);
  assert.equal(calls[1].body.expectedVersion, 3);

  await homeApi.checkIn("g1", { value: 42, note: "Up" });
  assert.equal(calls[2].method, "POST");
  assert.match(calls[2].url, /\/goals\/g1\/checkins$/);
  assert.deepEqual(calls[2].body, { value: 42, note: "Up" });

  await homeApi.linkTask("g1", { taskId: "t1", unlink: false });
  assert.match(calls[3].url, /\/goals\/g1\/tasks$/);
  assert.deepEqual(calls[3].body, { taskId: "t1", unlink: false });
});

test("a forbidden response surfaces the server message as an ApiError", async () => {
  nextResponse = { status: 403, body: { message: "Not allowed" } };
  await assert.rejects(homeApi.goal("g1"), (error) => error instanceof ApiError && error.status === 403 && error.message === "Not allowed");
});

test("remaining distance is phrased per measure", () => {
  const base = { childCount: 0, remaining: null, unit: null, measure: "METRIC" };
  assert.equal(format.remainingLabel({ ...base, remaining: 58, unit: "signups" }), "58 signups to go");
  assert.equal(format.remainingLabel({ ...base, measure: "TASKS", remaining: 3 }), "3 tasks open");
  assert.equal(format.remainingLabel({ ...base, measure: "TASKS", remaining: 1 }), "1 task open");
  assert.equal(format.remainingLabel({ ...base, remaining: 0 }), "Target reached");
  assert.equal(format.remainingLabel({ ...base, measure: "CHILDREN", childCount: 2 }), "2 aligned goals");
  assert.equal(format.remainingLabel({ ...base, remaining: null }), null);
});

test("goals group by scope in order and omit empty groups", () => {
  const goal = (id, scope) => ({ id, scope });
  const groups = format.groupGoalsByScope([goal("a", "PERSON"), goal("b", "COMPANY"), goal("c", "PERSON")]);
  assert.deepEqual(groups.map((group) => group.scope), ["COMPANY", "PERSON"]);
  assert.equal(groups[1].goals.length, 2);
});

test("health and percent labels read as text", () => {
  assert.equal(format.HEALTH_LABELS.AT_RISK, "At risk");
  assert.equal(format.HEALTH_TONES.OFF_TRACK, "danger");
  assert.equal(format.percentLabel(null), "No data");
  assert.equal(format.percentLabel(0.426), "43%");
  assert.equal(format.scopeLabel("MANAGER"), "Your reporting team");
});

test("overdue applies only to open tasks past their due day", () => {
  assert.equal(format.isOverdue("2026-11-01", "IN_PROGRESS", "2026-11-10"), true);
  assert.equal(format.isOverdue("2026-11-01", "DONE", "2026-11-10"), false);
  assert.equal(format.isOverdue(null, "TODO", "2026-11-10"), false);
});

const values = (overrides) => ({ ...draft.emptyGoalValues("COMPANY", "2026-11-01"), title: "Signups", dueDate: "2026-12-31", unit: "signups", startValue: "0", targetValue: "100", currentValue: "12", ...overrides });

test("metric goals need a unit and a target different from the start", () => {
  assert.deepEqual(draft.validateGoalValues(values({})), {});
  assert.ok(draft.validateGoalValues(values({ unit: "" })).unit);
  assert.ok(draft.validateGoalValues(values({ targetValue: "0" })).targetValue);
  assert.ok(draft.validateGoalValues(values({ currentValue: "" })).currentValue);
});

test("dates and scope pickers are validated and the payload drops foreign scope fields", () => {
  assert.ok(draft.validateGoalValues(values({ dueDate: "2026-10-01" })).dueDate);
  assert.ok(draft.validateGoalValues(values({ scope: "TEAM", teamId: "" })).teamId);
  const payload = draft.toGoalDraft(values({ scope: "COMPANY", departmentId: "d1", description: "  " }), "viewer");
  assert.equal(payload.ownerId, "viewer");
  assert.equal(payload.departmentId, null);
  assert.equal(payload.description, null);
  assert.equal(payload.targetValue, 100);
});

test("check-ins need a note and a numeric value for metric goals", () => {
  assert.ok(draft.validateCheckin("METRIC", "", "Up").errors.value);
  assert.ok(draft.validateCheckin("TASKS", "", "").errors.note);
  assert.deepEqual(draft.validateCheckin("METRIC", "7", "Up").errors, {});
  assert.equal(draft.validateCheckin("METRIC", "7", "Up").value, 7);
});
