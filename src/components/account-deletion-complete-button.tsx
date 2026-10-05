"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";
import { promptReason } from "@/lib/swal";

export function AccountDeletionCompleteButton({
  id,
  path = `/api/admin/account-deletions/${id}/complete`,
  label = "Mark completed",
  title = "Mark deletion completed",
  text = "Confirm personal data has been removed and only regulated records remain. This note is kept in the audit log.",
  variant = "secondary",
}: {
  id: string;
  path?: string;
  label?: string;
  title?: string;
  text?: string;
  variant?: "secondary" | "quiet";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function complete() {
    setError("");
    const note = await promptReason({ title, text, confirmLabel: label });
    if (!note) return;
    setBusy(true);
    const response = await adminFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setBusy(false);
    if (!response.ok && response.status !== 204) {
      const data = await response.json().catch(() => null) as { title?: string; detail?: string } | null;
      setError(data?.detail ?? data?.title ?? "Could not update this request.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <Button size="small" variant={variant} loading={busy} onClick={() => void complete()}>{label}</Button>
      {error ? <small className="ops-inline-note">{error}</small> : null}
    </>
  );
}
