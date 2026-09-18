"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ReasonModal } from "@/components/reason-modal";
import { DataTable } from "@/components/ui/data-table";
import { Badge, Button } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { adminFetch } from "@/lib/admin-session";
import type { AdminSessionView } from "@/lib/admin-types";
import { formatInstant, toneForStatus } from "@/lib/values";

export function SessionsPanel({ sessions, currentSessionId }: { sessions: AdminSessionView[]; currentSessionId: string }) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => sessions, [sessions]);

  async function confirm(reason: string) {
    if (!target) return;
    setBusy(true);
    setError("");
    const response = await adminFetch(`/api/auth/sessions/${target}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setBusy(false);
    if (!response.ok && response.status !== 204) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setError(data?.title ?? "The session could not be revoked.");
      return;
    }
    setTarget(null);
    router.refresh();
  }

  return (
    <>
      <DataTable
        columns={[
          { key: "id", header: "Session", render: (row) => row.id === currentSessionId ? `${row.id.slice(0, 8)}… (this device)` : `${row.id.slice(0, 8)}…` },
          { key: "ip", header: "IP", render: (row) => row.ipAddress || "—" },
          { key: "seen", header: "Last seen", render: (row) => formatInstant(row.lastSeenAt) },
          { key: "expires", header: "Expires", render: (row) => formatInstant(row.expiresAt) },
          {
            key: "status",
            header: "Status",
            render: (row) => row.revokedAt
              ? <Badge tone="danger">Revoked</Badge>
              : <Badge tone={toneForStatus("ACTIVE")} dot>Active</Badge>,
          },
          {
            key: "action",
            header: "",
            render: (row) => row.revokedAt ? null : (
              <Button size="small" variant="danger" onClick={() => { setTarget(row.id); setError(""); }}>Revoke</Button>
            ),
          },
        ]}
        rows={rows}
        getKey={(row) => row.id}
        empty={<EmptyState compact title="No sessions" description="There is no session history for this administrator." />}
      />
      <ReasonModal
        open={Boolean(target)}
        title="Revoke session"
        description="The administrator will need to sign in again on that device."
        confirmLabel="Revoke"
        busy={busy}
        error={error}
        onClose={() => { if (!busy) setTarget(null); }}
        onConfirm={confirm}
      />
    </>
  );
}
