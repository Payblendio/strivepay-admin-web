import type { Metadata } from "next";
import { OpsShell } from "@/components/ops-shell";
import { requireAdmin } from "@/lib/admin-session.server";

export const metadata: Metadata = { title: "Access denied" };

export default async function ForbiddenPage() {
  const { principal } = await requireAdmin(undefined, "/forbidden");
  return (
    <OpsShell
      principal={principal}
      eyebrow="Access"
      title="You don’t have this permission"
      copy="This area is hidden for your role. Ask a super-admin if you need access."
    >
      <section className="ops-panel">
        <p>The URL is valid, but your administrator role does not include the required permission.</p>
      </section>
    </OpsShell>
  );
}
