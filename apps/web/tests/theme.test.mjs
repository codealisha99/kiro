import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

// Compile the TypeScript module into a temp file so Node can import it directly.
const source = await readFile(new URL("../src/lib/theme.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dir = await mkdtemp(join(tmpdir(), "kiro-theme-"));
const file = join(dir, "theme.mjs");
await writeFile(file, output);
const theme = await import(pathToFileURL(file).href);

test("unknown preferences fall back to light", () => {
  assert.equal(theme.parseThemePreference(undefined), "light");
  assert.equal(theme.parseThemePreference("sepia"), "light");
  assert.equal(theme.parseThemePreference("dark"), "dark");
  assert.equal(theme.parseThemePreference("system"), "system");
});

test("system preference follows the operating system", () => {
  assert.equal(theme.resolveTheme("system", true), "dark");
  assert.equal(theme.resolveTheme("system", false), "light");
  assert.equal(theme.resolveTheme("dark", false), "dark");
  assert.equal(theme.resolveTheme("light", true), "light");
});

test("init script reads the same storage key", () => {
  assert.ok(theme.THEME_INIT_SCRIPT.includes(`"${theme.THEME_STORAGE_KEY}"`));
});
