"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { UserDto } from "@kiro/shared";
import { Alert, Button, Dialog, StatefulButton } from "@/components/ui";
import { WorkspaceIcon } from "./WorkspaceIcon";

export function AccountProfile({
  user,
  onLogout,
}: {
  user: UserDto;
  onLogout: () => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = user.name?.trim() || user.email.split("@")[0];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const role =
    user.role === "admin"
      ? "Administrator"
      : user.role === "manager"
        ? "Manager"
        : "Member";

  async function signOut() {
    setLeaving(true);
    setError(null);
    try {
      await onLogout();
    } catch {
      setError("Could not sign out. Please try again.");
      setLeaving(false);
    }
  }

  return (
    <>
      <div className="workspace-account">
        <button
          className="account-trigger"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label="Open your profile"
        >
          <span className="account-avatar">{initials}</span>
          <span className="account-summary">
            <strong>{name}</strong>
            <span>{role}</span>
          </span>
          <WorkspaceIcon name="settings" />
        </button>
      </div>
      {mounted &&
        createPortal(
          <Dialog
            open={open}
            onClose={() => {
              if (!leaving) setOpen(false);
            }}
            title="Your account"
            className="account-dialog"
          >
            <div className="profile-identity">
              <span className="account-avatar profile-avatar">{initials}</span>
              <h3>{name}</h3>
              <p>{user.email}</p>
              <span className="profile-role">
                <WorkspaceIcon name="shield" />
                {role}
              </span>
            </div>
            <dl className="profile-details">
              <div>
                <dt>
                  <WorkspaceIcon name="user" />
                  Full name
                </dt>
                <dd>{user.name || "Not provided"}</dd>
              </div>
              <div>
                <dt>
                  <WorkspaceIcon name="mail" />
                  Email address
                </dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>
                  <WorkspaceIcon name="shield" />
                  Workspace role
                </dt>
                <dd>{role}</dd>
              </div>
            </dl>
            {user.role === "admin" && (
              <Link className="profile-admin-link" href="/admin">
                <span className="profile-link-icon">
                  <WorkspaceIcon name="settings" />
                </span>
                <span>
                  <strong>Workspace overview</strong>
                  <small>Activity, sources, and answer quality</small>
                </span>
                <WorkspaceIcon name="chevron" />
              </Link>
            )}
            <p className="profile-privacy">
              <WorkspaceIcon name="lock" />
              Your access follows your workspace permissions.
            </p>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="profile-actions">
              <StatefulButton
                variant="secondary"
                loading={leaving}
                onClick={() => void signOut()}
              >
                {!leaving && <WorkspaceIcon name="logout" />}
                {leaving ? "Signing out…" : "Sign out"}
              </StatefulButton>
              <Button
                variant="primary"
                disabled={leaving}
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          </Dialog>,
          document.body,
        )}
    </>
  );
}
