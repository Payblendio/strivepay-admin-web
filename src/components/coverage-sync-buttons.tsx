"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";

export function CoverageSyncButtons({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"settlement" | "quidax" | null>(null);
  const [message, setMessage] = useState("");

  if (!canManage) return null;

  async function sync(kind: "settlement" | "quidax") {
    setBusy(kind);
    setMessage("");
    const path = kind === "settlement"
      ? "/api/admin/coverage/settlement/sync"
      : "/api/admin/coverage/quidax/sync";
    const response = await adminFetch(path, { method: "POST" });
    setBusy(null);
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setMessage(data?.title ?? "Coverage sync failed.");
      return;
    }
    setMessage(kind === "settlement" ? "Settlement coverage sync queued." : "Quidax catalog sync queued.");
    router.refresh();
  }

  return (
    <div className="ops-stack">
      <div className="reason-actions">
        <Button size="small" variant="secondary" loading={busy === "settlement"} onClick={() => void sync("settlement")}>
          Sync settlement coverage
        </Button>
        <Button size="small" variant="secondary" loading={busy === "quidax"} onClick={() => void sync("quidax")}>
          Sync Quidax catalog
        </Button>
      </div>
      {message ? <small className="ops-inline-note">{message}</small> : null}
    </div>
  );
}
