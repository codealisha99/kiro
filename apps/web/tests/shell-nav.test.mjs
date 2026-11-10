import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

// Compile the shell's pure modules into a temp directory so they can be imported as ES modules.
async function load(name) {
  const source = await readFile(new URL(`../src/components/shell/${name}.ts`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dir = await mkdtemp(join(tmpdir(), `kiro-${name}-`));
  const file = join(dir, `${name}.mjs`);
  await writeFile(file, output);
  return import(pathToFileURL(file).href);
}

const nav = await load("nav");
const palette = await load("palette-model");

test("views resolve from ?view= and the xero redirect still opens company dashboards", () => {
  assert.equal(nav.viewFromSearch("?view=goals"), "goals");
  assert.equal(nav.viewFromSearch("?view=nonsense"), null);
  assert.equal(nav.viewFromSearch("?integration=xero"), "organization");
  assert.equal(nav.viewFromSearch("?integration=googledrive&oauth=success"), "organization");
  assert.equal(nav.viewFromSearch("?integration=googleanalytics&oauth=error"), "organization");
  assert.equal(nav.viewFromSearch("?integration=slack"), null);
  assert.equal(nav.viewFromSearch("?mode=register"), null);
});

test("changing a view keeps unrelated parameters", () => {
  assert.equal(nav.searchForView("?mode=register", "library"), "?mode=register&view=library");
  assert.equal(nav.searchForView("?view=home", "ask"), "?view=ask");
});

test("chords map to views and ignore unknown keys", () => {
  assert.equal(nav.resolveChord("g"), "goals");
  assert.equal(nav.resolveChord("H"), "home");
  assert.equal(nav.resolveChord("z"), null);
});

test("editable targets are detected so shortcuts stay out of fields", () => {
  assert.equal(nav.isEditableTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(nav.isEditableTarget({ tagName: "INPUT" }), true);
  assert.equal(nav.isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(nav.isEditableTarget({ tagName: "BUTTON" }), false);
  assert.equal(nav.isEditableTarget(null), false);
});

test("palette filter requires every word and ranks prefix matches first", () => {
  const items = [
    { id: "a", group: "Navigate", label: "Library", keywords: "documents" },
    { id: "b", group: "Create", label: "New goal", keywords: "objective target" },
    { id: "c", group: "Navigate", label: "Goals", keywords: "targets okrs" },
    { id: "d", group: "Navigate", label: "Projects & tasks" },
  ];
  assert.deepEqual(palette.filterPaletteItems(items, "").map((i) => i.id), ["a", "b", "c", "d"]);
  assert.deepEqual(palette.filterPaletteItems(items, "goal").map((i) => i.id), ["c", "b"]);
  assert.deepEqual(palette.filterPaletteItems(items, "target goal").map((i) => i.id), ["b", "c"]);
  assert.deepEqual(palette.filterPaletteItems(items, "document").map((i) => i.id), ["a"]);
  assert.deepEqual(palette.filterPaletteItems(items, "zzz"), []);
});
