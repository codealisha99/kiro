"use client";

import Link from "next/link";
import { KiroMark, WorkspaceIcon } from "./WorkspaceIcon";
import "./auth-screen.css";
import { Alert, Button, Field, Input } from "@/components/ui";

import { FormEvent, useState } from "react";
import { api, setToken } from "@/lib/api";

export default function AuthScreen({
  onAuthed,
  initialMode = "login",
  sessionExpired = false,
}: {
  onAuthed: () => void;
  initialMode?: "login" | "register";
  sessionExpired?: boolean;
}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [passwordVisible, setPasswordVisible] = useState(false);
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
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await api.login({
              email: form.email.trim(),
              password: form.password,
            })
          : await api.register({
              tenantName: form.tenantName.trim(),
              email: form.email.trim(),
              password: form.password,
              name: form.name.trim() || undefined,
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
    <main className="signin-page">
      <section className="signin-story" aria-labelledby="signin-story-title">
        <Link href="/" className="signin-brand" aria-label="Kiro home">
          <KiroMark />
          <span>kiro</span>
        </Link>
        <div className="signin-story-content">
          <p className="signin-eyebrow">Your company knowledge, within reach</p>
          <h1 id="signin-story-title">
            A little clarity.
            <br />A better workday.
          </h1>
          <p className="signin-story-description">
            The policies, processes, and context your team needs. One place to
            ask. The evidence close by.
          </p>
          <div
            className="signin-photo"
            role="img"
            aria-label="Kiro knowledge desk with books and handwritten notes"
          />
          <div className="signin-story-caption">
            <WorkspaceIcon name="book" />
            <span>Company knowledge. With the source.</span>
          </div>
        </div>
        <p className="signin-story-footer">
          Built for the things your team already knows.
        </p>
      </section>
      <section className="signin-form-area" aria-labelledby="signin-title">
        <Link className="signin-back" href="/">
          <span aria-hidden="true">←</span> Back to Kiro
        </Link>
        <div className="signin-card">
          <div className="signin-form-mark">
            <KiroMark />
          </div>
          <h2 id="signin-title">
            {mode === "login" ? "Welcome back." : "Make room for knowledge."}
          </h2>
          <p className="signin-form-description">
            {mode === "login"
              ? "Sign in to your company’s knowledge desk."
              : "Create a workspace for what your team knows."}
          </p>

          {sessionExpired && (
            <Alert>
              Your session has expired. Sign in to return to your desk.
            </Alert>
          )}
          {error && <Alert tone="danger">{error}</Alert>}

          <form className="form signin-form" onSubmit={submit}>
            {mode === "register" && (
              <>
                <Field label="Company name">
                  {(field) => (
                    <Input
                      {...field}
                      autoComplete="organization"
                      placeholder="Your company or team"
                      value={form.tenantName}
                      onChange={(e) =>
                        setForm({ ...form, tenantName: e.target.value })
                      }
                      required
                    />
                  )}
                </Field>
                <Field label="Your name" hint="Optional">
                  {(field) => (
                    <Input
                      {...field}
                      autoComplete="name"
                      placeholder="What should we call you?"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  )}
                </Field>
              </>
            )}
            <Field label="Work email">
              {(field) => (
                <Input
                  {...field}
                  autoComplete="email"
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              )}
            </Field>
            <Field
              label="Password"
              hint={
                mode === "register" ? "Use at least 8 characters." : undefined
              }
            >
              {(field) => (
                <div className="signin-password">
                  <Input
                    {...field}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    type={passwordVisible ? "text" : "password"}
                    placeholder={
                      mode === "login"
                        ? "Enter your password"
                        : "Choose a password"
                    }
                    minLength={mode === "register" ? 8 : undefined}
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    required
                  />
                  <button
                    type="button"
                    aria-label={
                      passwordVisible ? "Hide password" : "Show password"
                    }
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible(!passwordVisible)}
                  >
                    {passwordVisible ? "Hide" : "Show"}
                  </button>
                </div>
              )}
            </Field>
            <Button
              variant="primary"
              fullWidth
              type="submit"
              disabled={busy}
              aria-busy={busy}
            >
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create a workspace"}
            </Button>
          </form>

          <p className="signin-switch">
            {mode === "login" ? "New here?" : "Already have a desk?"}{" "}
            <button
              className="link-btn"
              disabled={busy}
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
                setPasswordVisible(false);
                setForm({ ...form, password: "" });
              }}
            >
              {mode === "login" ? "Create a workspace" : "Sign in"}
            </button>
          </p>
          <p className="signin-privacy">
            <WorkspaceIcon name="lock" />
            Your workspace. Your authorized sources.
          </p>
        </div>
        <p className="signin-area-footer">
          Ask what the company knows. See the source.
        </p>
      </section>
    </main>
  );
}
