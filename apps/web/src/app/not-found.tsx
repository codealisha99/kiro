import Link from "next/link";
import { KiroMark } from "@/components/WorkspaceIcon";

export default function NotFound() {
  return (
    <main className="recovery-page">
      <div className="recovery-content">
        <Link href="/" className="recovery-brand">
          <KiroMark /> kiro
        </Link>
        <p className="brand-mark">404 / Page not found</p>
        <h1>
          Let’s get you back
          <br />
          to the right place.
        </h1>
        <p className="recovery-description">
          This page may have moved, or the address may be incomplete. Your
          knowledge desk is still within reach.
        </p>
        <div className="actions">
          <Link className="btn signal" href="/app">
            Open the desk
          </Link>
          <Link className="btn ghost" href="/">
            Kiro home
          </Link>
        </div>
      </div>
    </main>
  );
}
