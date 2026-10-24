import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Execute the actual transport module without adding a browser test dependency.
const source = await readFile(
  new URL("../src/lib/api.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { api, ApiError, SESSION_EXPIRED_EVENT } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`
);
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
let store;
let events;
beforeEach(() => {
  store = new Map([["kiro-token", "test-session"]]);
  events = [];
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    },
    dispatchEvent: (event) => {
      events.push(event.type);
      return true;
    },
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test("protected 401 clears the token and signals session recovery", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Expired" }), { status: 401 });
  await assert.rejects(
    api.me(),
    (error) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(store.has("kiro-token"), false);
  assert.deepEqual(events, [SESSION_EXPIRED_EVENT]);
});
test("invalid login stays on the auth form without a session event", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Invalid credentials" }), {
      status: 401,
    });
  await assert.rejects(
    api.login({ email: "test@example.com", password: "incorrect" }),
    /Invalid credentials/,
  );
  assert.deepEqual(events, []);
  assert.equal(store.get("kiro-token"), "test-session");
});
test("403 preserves the session and exposes the denial", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
  await assert.rejects(api.adminMetrics(), (error) => error.status === 403);
  assert.equal(store.get("kiro-token"), "test-session");
  assert.deepEqual(events, []);
});
test("network failure gives a readable recovery message", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(api.documents(), /Check your connection and try again/);
  assert.equal(store.get("kiro-token"), "test-session");
});
test("JSON requests retain the bearer token and validation messages", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test-session");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), { query: "policy?" });
    return new Response(
      JSON.stringify({ message: ["First error", "Second error"] }),
      { status: 400 },
    );
  };
  await assert.rejects(
    api.query({ query: "policy?" }),
    /First error, Second error/,
  );
});
test("multipart upload leaves boundary generation to the browser and expires sessions", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers["Content-Type"], undefined);
    assert.equal(options.headers.Authorization, "Bearer test-session");
    assert.ok(options.body instanceof FormData);
    return new Response("", { status: 401 });
  };
  await assert.rejects(
    api.uploadDocument(new File(["policy"], "policy.txt"), {}),
    (error) => error.status === 401,
  );
  assert.deepEqual(events, [SESSION_EXPIRED_EVENT]);
});

test("an old request cannot expire a newly signed-in session", async () => {
  globalThis.fetch = async () => {
    store.set("kiro-token", "new-session");
    return new Response("", { status: 401 });
  };
  await assert.rejects(api.me(), (error) => error.status === 401);
  assert.equal(store.get("kiro-token"), "new-session");
  assert.deepEqual(events, []);
});


test("a stalled response body is aborted and offers safe retry guidance", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback) => originalSetTimeout(callback, 5);
  globalThis.fetch = async (_url, options) => ({
    text: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
  });
  try {
    await assert.rejects(api.documents(), /may have completed/);
    assert.equal(store.get("kiro-token"), "test-session");
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("document removal uses the authorized delete endpoint", async () => {
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith("/documents/d1"));
    assert.equal(options.method, "DELETE");
    assert.equal(options.headers.Authorization, "Bearer test-session");
    return new Response(JSON.stringify({ ok: true }));
  };
  assert.deepEqual(await api.deleteDocument("d1"), { ok: true });
});


test("historical documents use the version endpoint and encoded document id", async () => {
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith("/documents/doc%2Fid/versions/2"));
    assert.equal(options.method, "GET");
    return new Response(JSON.stringify({ selectedVersion: 2, content: "Earlier policy" }));
  };
  assert.equal((await api.documentVersion("doc/id", 2)).content, "Earlier policy");
});

test("a stale revision remains a recoverable conflict with the original session", async () => {
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith("/documents/d1"));
    assert.equal(options.method, "PATCH");
    assert.deepEqual(JSON.parse(options.body), { title: "Policy", content: "Draft", expectedVersion: 1 });
    return new Response(JSON.stringify({ message: "A newer version was saved" }), { status: 409 });
  };
  await assert.rejects(api.updateDocument("d1", { title: "Policy", content: "Draft", expectedVersion: 1 }),
    (error) => error instanceof ApiError && error.status === 409);
  assert.equal(store.get("kiro-token"), "test-session");
});

test("sign-out has a shorter deadline than document revisions", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const deadlines = [];
  globalThis.setTimeout = (callback, delay) => { deadlines.push(delay); return originalSetTimeout(callback, delay); };
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }));
  try {
    await api.logout();
    await api.updateDocument("d1", { title: "Policy", content: "Draft", expectedVersion: 1 });
    assert.deepEqual(deadlines, [20_000, 120_000]);
  } finally { globalThis.setTimeout = originalSetTimeout; }
});
