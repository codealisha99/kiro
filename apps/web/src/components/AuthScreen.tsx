"use client";

import { FormEvent, useState } from "react";
import { api, setToken } from "@/lib/api";

export default function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    tenantName: "",
    email: "",
    password: "",
    name: "",
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await api.login({ email: form.email, password: form.password })
          : await api.register({
              tenantName: form.tenantName,
              email: form.email,
              password: form.password,
              name: form.name || undefined,
            });
      setToken(res.tokens.accessToken);
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-cover">
      <div
        className="auth-cover-photo"
        style={{ backgroundImage: "url(/cover.png)" }}
        aria-hidden
      />
      <div className="auth-cover-shade" aria-hidden />
      <div className="auth-cover-inner">
        <div className="auth-hero">
          <div className="brand-mark">Internal knowledge</div>
          <h1>Kiro</h1>
          <p>
            Ask what the company knows. Every answer comes with a paper trail
            you are allowed to see.
          </p>
        </div>

        <div className="auth-card">
          <div className="brand-mark">
            {mode === "login" ? "Sign in" : "New workspace"}
          </div>
          <h2>{mode === "login" ? "Open the desk" : "Create a workspace"}</h2>

          {error && <div className="err">{error}</div>}

          <form className="form" onSubmit={submit}>
            {mode === "register" && (
              <>
                <input
                  placeholder="Company name"
                  value={form.tenantName}
                  onChange={(e) =>
                    setForm({ ...form, tenantName: e.target.value })
                  }
                  required
                />
                <input
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </>
            )}
            <input
              type="email"
              placeholder="Work email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <button className="btn block" type="submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Open the desk"
                  : "Create a workspace"}
            </button>
          </form>

          <p className="muted" style={{ marginTop: 16 }}>
            {mode === "login" ? "New here?" : "Already have a desk?"}{" "}
            <button
              className="link-btn"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Create a workspace" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
