import type { Metadata } from "next";
import { OpsShell } from "@/components/ops-shell";
import { PageNav } from "@/components/page-nav";
import { EmptyState } from "@/components/ui/status-state";
import { WebhookLogs } from "@/components/webhook-logs";
import { WebhookNav } from "@/components/webhook-nav";
import { WebhookSetup } from "@/components/webhook-setup";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { API_URL, responseBody } from "@/lib/backend";
import type { AdminPage } from "@/lib/admin-types";
import { asRecord } from "@/lib/values";
import { webhookHref, webhookProvider, type WebhookView } from "@/lib/webhooks";

export const metadata: Metadata = { title: "Webhooks" };

type Search = Promise<{
  provider?: string | string[];
  view?: string | string[];
  status?: string | string[];
  errorsOnly?: string | string[];
  page?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function WebhooksPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const provider = webhookProvider(first(params.provider)).value;
  const view = (first(params.view) === "logs" ? "logs" : "setup") as WebhookView;
  const status = first(params.status);
  const errorsOnly = first(params.errorsOnly) === "true";
  const page = Math.max(0, Number(first(params.page) || 0) || 0);
  const size = 20;
  const { token, principal } = await requireAdmin(PERMISSIONS.webhooksView, "/webhooks");
  const config = webhookProvider(provider);

  let rows: Record<string, unknown>[] = [];
  let total = 0;
  let listPage = page;
  let logsOk = true;
  if (view === "logs") {
    const query = new URLSearchParams({ provider, page: String(page), size: String(size), errorsOnly: String(errorsOnly) });
    if (status) query.set("status", status);
    const response = await adminBackend(token, `/v1/admin/webhooks?${query}`);
    logsOk = response.ok;
    const data = response.ok ? await responseBody(response) as AdminPage : { page, size, total: 0, items: [] };
    rows = (data.items ?? []).map(asRecord);
    total = data.total ?? 0;
    listPage = data.page ?? page;
  }

  function hrefFor(nextPage: number) {
    const extra: Record<string, string> = {};
    if (status) extra.status = status;
    if (errorsOnly) extra.errorsOnly = "true";
    if (nextPage > 0) extra.page = String(nextPage);
    return webhookHref(provider, "logs", extra);
  }

  return (
    <OpsShell
      principal={principal}
      eyebrow="Provider callbacks"
      title="Webhooks"
      copy="Set up inbound Bakkt callbacks, then inspect the inbox."
    >
      <WebhookNav provider={provider} view={view} />

      {view === "setup" ? (
        <WebhookSetup
          key={provider}
          provider={provider}
          callbackUrl={`${API_URL}${config.callbackPath}`}
          canSync={hasPermission(principal.permissions, PERMISSIONS.coverageManage)}
          canManage={hasPermission(principal.permissions, PERMISSIONS.webhooksManage)}
        />
      ) : (
        <>
          <form className="ops-toolbar" method="get">
            <input type="hidden" name="provider" value={provider} />
            <input type="hidden" name="view" value="logs" />
            <label className="sp-field">
              <span>Status</span>
              <select name="status" defaultValue={status}>
                <option value="">Any status</option>
                <option value="RECEIVED">Received</option>
                <option value="PROCESSED">Processed</option>
                <option value="FAILED">Failed</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </label>
            <label className="sp-field">
              <span>Events</span>
              <select name="errorsOnly" defaultValue={errorsOnly ? "true" : ""}>
                <option value="">All events</option>
                <option value="true">Errors only</option>
              </select>
            </label>
            <button className="sp-button primary medium" type="submit">Filter</button>
          </form>
          <section className="ops-panel">
            <h2>{config.label} logs</h2>
            {!logsOk ? (
              <EmptyState compact title="Webhook logs unavailable" description="Inbound events could not be loaded." />
            ) : (
              <>
                <WebhookLogs
                  provider={provider}
                  rows={rows}
                  canManage={hasPermission(principal.permissions, PERMISSIONS.webhooksManage)}
                />
                <PageNav page={listPage} size={size} total={total} hrefFor={hrefFor} />
              </>
            )}
          </section>
        </>
      )}
    </OpsShell>
  );
}
