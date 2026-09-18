import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/status-state";
import { OpsShell } from "@/components/ops-shell";
import { SessionsPanel } from "@/components/sessions-panel";
import { requireAdmin, adminBackend } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import type { AdminSessionView } from "@/lib/admin-types";

export const metadata: Metadata = { title: "Sessions" };

export default async function SessionsPage() {
  const { token, principal } = await requireAdmin(undefined, "/sessions");
  const response = await adminBackend(token, "/v1/admin/auth/sessions");
  const sessions = response.ok ? await responseBody(response) as AdminSessionView[] : [];

  return (
    <OpsShell
      principal={principal}
      eyebrow="Account"
      title="Sessions"
      copy="Active and revoked administrator sessions for your account."
    >
      <section className="ops-panel">
        {!response.ok ? (
          <EmptyState compact title="Sessions unavailable" description="Active sessions could not be loaded." />
        ) : (
          <SessionsPanel sessions={sessions ?? []} currentSessionId={principal.sessionId} />
        )}
      </section>
    </OpsShell>
  );
}
