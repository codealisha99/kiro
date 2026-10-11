"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { KiroMark } from "@/components/WorkspaceIcon";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="recovery-page">
      <div className="recovery-content">
        <Link href="/" className="recovery-brand">
          <KiroMark /> kiro
        </Link>
        <p className="brand-mark">Something went wrong</p>
        <h1>A pause in the conversation.</h1>
        <p className="recovery-description">
          Kiro couldn’t open this view. Try again, or return to the home page.
        </p>
        <div className="actions">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Link className="btn ghost" href="/">
            Kiro home
          </Link>
        </div>
      </div>
    </main>
  );
}
