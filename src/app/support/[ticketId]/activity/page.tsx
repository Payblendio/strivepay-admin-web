import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IconMessageCircle, IconId, IconHistory } from "@tabler/icons-react";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { Badge } from "@/components/ui/primitives";
import { hasPermission, loginHref } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { investigationContext, investigationHistory, recordedAmount, supportId } from "@/lib/support-investigation";
import "@/components/support-workspace.css";

export const metadata = { title: "Support transaction" };

export default async function SupportTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ before?: string | string[] }>;
}) {
  const { ticketId } = await params;
  const path = `/support/${ticketId}/activity`;
  const { token, principal } = await requireAdmin("support.view", path);
  if (!hasPermission(principal.permissions, "transactions.view")) redirect("/forbidden");
  const { before } = await searchParams;
  if (!supportId.safeParse(ticketId).success || (before !== undefined && !supportId.safeParse(before).success)) notFound();
  const current = path + (before ? `?before=${before}` : "");
  const contextResponse = await adminBackend(token, `/v1/admin/support/tickets/${ticketId}/activity`).catch(() => null);
  if (contextResponse?.status === 401) redirect(loginHref(current, "session-expired"));
  if (contextResponse?.status === 403) redirect("/forbidden");
  const context = contextResponse?.ok ? investigationContext.safeParse(await responseBody(contextResponse)) : null;
  const data = context?.success ? context.data : null;
  const historyResponse = data?.activity
    ? await adminBackend(token, `/v1/admin/support/tickets/${ticketId}/activity/history?size=30${before ? `&before=${before}` : ""}`).catch(() => null)
    : null;
  if (historyResponse?.status === 401) redirect(loginHref(current, "session-expired"));
  if (historyResponse?.status === 403) redirect("/forbidden");
  const parsed = historyResponse?.ok ? investigationHistory.safeParse(await responseBody(historyResponse)) : null;
  const history = parsed?.success ? parsed.data : null;
  const facts = data?.facts;
  const kindLabel = data?.activity?.kind === "RAMP"
    ? "Bank / crypto transfer"
    : data?.activity?.kind === "CONVERSION"
      ? "Conversion"
      : "Order";

  return (
    <OpsShell principal={principal} eyebrow="Customer care" title="Transaction investigation" copy="Read-only records for this support request.">
      <OpsDetailShell
        backHref={`/support?ticket=${ticketId}`}
        backLabel="Back to conversation"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconMessageCircle size={20} />}
            title={data?.activity ? kindLabel : "Transaction investigation"}
            status={facts ? <Badge tone="info">{facts.status.replaceAll("_", " ")}</Badge> : undefined}
            subtitle={data?.activity?.id ?? ticketId}
          />
        )}
        headerActions={<a className="ops-link" href={current}>Refresh</a>}
        sidebarSummary={facts ? (
          <OpsDetailSummary
            items={[
              { label: "Status", value: facts.status.replaceAll("_", " ") },
              { label: "Direction", value: facts.direction.replaceAll("_", " ") },
              { label: "Source", value: recordedAmount(facts.sourceAmount, facts.sourceAsset) },
              { label: "Destination", value: recordedAmount(facts.destinationAmount, facts.destinationAsset) },
            ]}
          />
        ) : undefined}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: <IconId size={16} />,
            content: !data ? (
              <OpsDetailSection title="Unavailable">
                <p role="alert">The linked record could not be loaded. Refresh to retry; no financial action has been taken.</p>
              </OpsDetailSection>
            ) : !data.activity ? (
              <OpsDetailSection title="No linked transaction">
                <p>This support request is not linked to a transfer.</p>
              </OpsDetailSection>
            ) : (
              <OpsDetailSection title={kindLabel}>
                <OpsDetailFacts
                  items={[
                    {
                      label: "Reference",
                      value: data.activity.kind === "CONVERSION"
                        ? data.activity.id
                        : <Link className="ops-link" href={`/transactions/${data.activity.id}`}>{data.activity.id}</Link>,
                    },
                    ...(facts ? [
                      { label: "Status", value: facts.status.replaceAll("_", " ") },
                      { label: "Direction", value: facts.direction.replaceAll("_", " ") },
                      { label: "Source amount", value: recordedAmount(facts.sourceAmount, facts.sourceAsset) },
                      { label: "Destination amount", value: recordedAmount(facts.destinationAmount, facts.destinationAsset) },
                      { label: "Created (UTC)", value: <time dateTime={facts.createdAt}>{new Date(facts.createdAt).toISOString().replace("T", " ")}</time> },
                    ] : []),
                  ]}
                />
                <p className="ops-panel-copy">Recorded values at this refresh, not a settlement guarantee.</p>
              </OpsDetailSection>
            ),
          },
          {
            id: "history",
            label: "History",
            icon: <IconHistory size={16} />,
            content: (
              <OpsDetailSection title="Status history">
                <p className="ops-panel-copy">Newest first · UTC. Only recorded changes are shown.</p>
                {!data?.activity ? (
                  <p>No linked transaction.</p>
                ) : !history ? (
                  <p role="alert">History could not be loaded. Use Refresh to retry.</p>
                ) : (
                  <>
                    {history.items.length === 0 ? (
                      <p>No recorded changes on this page.</p>
                    ) : (
                      <ol className="support-investigation-history">
                        {history.items.map((item) => (
                          <li key={item.id}>
                            <strong>{item.status.replaceAll("_", " ")}</strong>
                            <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toISOString().replace("T", " ")}</time>
                          </li>
                        ))}
                      </ol>
                    )}
                    <nav aria-label="History pages">
                      {before ? <Link className="ops-link" href={path}>Newest changes</Link> : null}
                      {before && history.hasMore ? " · " : null}
                      {history.hasMore ? <Link className="ops-link" href={`${path}?before=${history.before}`}>Older changes</Link> : null}
                    </nav>
                  </>
                )}
              </OpsDetailSection>
            ),
          },
        ]}
      />
    </OpsShell>
  );
}
