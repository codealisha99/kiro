import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

// Compile the chart math into a temp directory and import it as an ES module.
const source = await readFile(new URL("../src/components/charts/scale.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dir = await mkdtemp(join(tmpdir(), "kiro-scale-"));
const file = join(dir, "scale.mjs");
await writeFile(file, output);
const scale = await import(pathToFileURL(file).href);

test("linear scale maps and inverts, and handles a flat domain", () => {
  const x = scale.linearScale([0, 10], [0, 200]);
  assert.equal(x(5), 100);
  assert.equal(x.invert(150), 7.5);
  const flat = scale.linearScale([4, 4], [0, 100]);
  assert.equal(flat(4), 50);
});

test("nice ticks cover the span with round steps", () => {
  assert.deepEqual(scale.niceTicks(0, 97, 5), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(scale.niceTicks(0.1, 0.9, 4), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(scale.niceTicks(5, 5), [5]);
  assert.deepEqual(scale.niceTicks(Number.NaN, 3), []);
});

test("nice domain includes zero on request and widens empty ranges", () => {
  assert.deepEqual(scale.niceDomain([12, 48], { includeZero: true }), [0, 50]);
  const [low, high] = scale.niceDomain([7, 7]);
  assert.ok(low <= 6 && high >= 8);
  assert.deepEqual(scale.niceDomain([]), [0, 1]);
});

test("nearest index finds the closest sorted value", () => {
  const xs = [1, 4, 9, 16];
  assert.equal(scale.nearestIndex(xs, 0), 0);
  assert.equal(scale.nearestIndex(xs, 6), 1);
  assert.equal(scale.nearestIndex(xs, 7), 2);
  assert.equal(scale.nearestIndex(xs, 100), 3);
  assert.equal(scale.nearestIndex([], 3), -1);
});

test("stack offsets accumulate positive values and ignore bad numbers", () => {
  assert.deepEqual(scale.stackOffsets([2, 3, Number.NaN, -1, 5]), [
    { start: 0, end: 2 },
    { start: 2, end: 5 },
    { start: 5, end: 5 },
    { start: 5, end: 5 },
    { start: 5, end: 10 },
  ]);
});

test("formatting uses compact axis values and a true minus sign", () => {
  assert.equal(scale.formatCompact(1284), "1.3K");
  assert.equal(scale.formatCompact(Number.NaN), "No data");
  assert.equal(scale.formatPercent(0.48), "48%");
  assert.equal(scale.formatPercent(null), "No data");
  assert.equal(scale.formatDelta(-4, " goals"), "−4 goals");
  assert.equal(scale.formatDelta(3), "+3");
});

test("time ticks follow real time and never crowd each other", () => {
  const day = 86_400_000;
  // Check-ins clustered at the end of a long window: index-based ticks would stack labels together.
  const xs = [0, 120, 127, 134, 141, 148, 155].map((d) => d * day);
  const px = scale.linearScale([xs[0], xs[xs.length - 1]], [0, 600]);
  const ticks = scale.timeTickIndexes(xs, px, 5, 64);
  assert.equal(ticks[0], 0);
  for (let i = 1; i < ticks.length; i++) assert.ok(px(xs[ticks[i]]) - px(xs[ticks[i - 1]]) >= 64);
  assert.deepEqual(scale.timeTickIndexes([], px), []);
  assert.deepEqual(scale.timeTickIndexes([5 * day], px), [0]);
});
