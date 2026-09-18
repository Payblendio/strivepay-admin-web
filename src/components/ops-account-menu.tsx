"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { IconChevronDown, IconLogout, IconShieldLock, IconUserShield } from "@tabler/icons-react";

export function OpsAccountMenu({
  name,
  email,
  onSignOut,
}: {
  name: string;
  email: string;
  onSignOut: () => void | Promise<void>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && rootRef.current?.contains(document.activeElement)) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    await onSignOut();
    setBusy(false);
  }

  return (
    <div className={`ops-account-menu${open ? " open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="dashboard-account-switcher"
        ref={buttonRef}
        aria-controls={id}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="dashboard-account-switcher-icon" aria-hidden="true">
          <IconUserShield size={18} stroke={1.75} />
        </span>
        <span className="dashboard-account-switcher-copy">
          <strong>{name}</strong>
          <span>{email}</span>
        </span>
        <IconChevronDown size={18} className="dashboard-profile-caret" aria-hidden="true" />
      </button>
      {open ? (
        <nav className="ops-account-panel" id={id} role="menu" aria-label="Account actions">
          <Link href="/sessions" role="menuitem" onClick={() => setOpen(false)}>
            <IconShieldLock size={16} /> Sessions
          </Link>
          <button type="button" role="menuitem" disabled={busy} onClick={() => void signOut()}>
            <IconLogout size={16} /> {busy ? "Signing out…" : "Sign out"}
          </button>
        </nav>
      ) : null}
    </div>
  );
}
