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

const library = await load("library-model");

const docs = [
  { id: "1", sourceId: "s1", title: "Refund policy", classification: "internal", status: "published", updatedAt: "2026-11-01T10:00:00Z", versionCount: 3 },
  { id: "2", sourceId: "s2", title: "Pricing sheet", classification: "restricted", status: "draft", updatedAt: "2026-11-05T10:00:00Z", versionCount: 1 },
  { id: "3", sourceId: "s1", title: "Onboarding checklist", classification: "public", status: "published", updatedAt: "2026-10-20T10:00:00Z", versionCount: 2 },
];
const names = new Map([["s1", "Handbook"], ["s2", "Finance drive"]]);

test("search matches the title or the source name, case-insensitively", () => {
  assert.deepEqual(library.filterDocuments(docs, names, { search: "  HANDBOOK ", access: "all" }).map((d) => d.id), ["1", "3"]);
  assert.deepEqual(library.filterDocuments(docs, names, { search: "pricing", access: "all" }).map((d) => d.id), ["2"]);
});

test("access chips filter by classification and report counts for every chip", () => {
  assert.deepEqual(library.filterDocuments(docs, names, { search: "", access: "restricted" }).map((d) => d.id), ["2"]);
  assert.deepEqual(library.accessCounts(docs), { all: 3, internal: 1, public: 1, confidential: 0, restricted: 1 });
});

test("sorting returns a new array in the requested order without mutating the input", () => {
  const before = docs.map((d) => d.id);
  assert.deepEqual(library.sortDocuments(docs, "title").map((d) => d.id), ["3", "2", "1"]);
  assert.deepEqual(library.sortDocuments(docs, "updated").map((d) => d.id), ["2", "1", "3"]);
  assert.deepEqual(docs.map((d) => d.id), before);
});

test("labels use the product's access and status wording", () => {
  assert.equal(library.accessLabel("internal"), "Workspace");
  assert.equal(library.accessLabel("public"), "Public");
  assert.equal(library.documentStatusLabel("draft"), "Draft");
  assert.equal(library.documentStatusTone("published"), "success");
});

test("freshness groups documents by how recently they changed", () => {
  const now = Date.UTC(2026, 10, 10);
  const day = 86_400_000;
  const docs = [0, 30, 31, 182, 183, 900].map((d) => ({ updatedAt: new Date(now - d * day).toISOString() }));
  assert.deepEqual(library.freshnessSegments(docs, now).map((s) => s.value), [2, 2, 2]);
});
