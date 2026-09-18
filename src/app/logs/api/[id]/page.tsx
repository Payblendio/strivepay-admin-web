import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconHistory, IconId, IconFileText, IconFileCode } from "@tabler/icons-react";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, asString, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "API request" };

function preview(value: unknown) {
  const body = asString(value);
  if (!body) return "No body was stored.";
  return body.length > 8000 ? `${body.slice(0, 8000)}…` : body;
}

function actorValue(type: string, id: string) {
  if (type === "—" && id === "—") return "—";
  if (type === "ADMIN" && id !== "—") {
    return <>{type} · <Link className="ops-link" href={`/team/${id}`}>{id}</Link></>;
  }
  if ((type === "CUSTOMER" || type === "CORPORATE_MEMBER") && id !== "—") {
    return <>{type} · <Link className="ops-link" href={`/customers/${id}`}>{id}</Link></>;
  }
  return `${type}${id !== "—" ? ` · ${id}` : ""}`;
}

export default async function ApiRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, principal } = await requireAdmin(PERMISSIONS.auditView, `/logs/api/${id}`);
  const response = await adminBackend(token, `/v1/admin/api-request-logs/${id}`);
  if (response.status === 400 || response.status === 404) notFound();
  if (!response.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Audit trail" title="API request" copy={id}>
        <EmptyState title="API request unavailable" description="This request log could not be loaded. Refresh and try again." />
      </OpsShell>
    );
  }
  const row = asRecord(await responseBody(response));
  const status = text(row, "response_status", "responseStatus");
  const method = text(row, "http_method", "httpMethod");
  const service = text(row, "service_code", "serviceCode");
  const duration = text(row, "duration_ms", "durationMs") === "—" ? "—" : `${text(row, "duration_ms", "durationMs")} ms`;
  const actorType = text(row, "actor_type", "actorType");
  const actorId = text(row, "actor_id", "actorId");

  return (
    <OpsShell principal={principal} eyebrow="Audit trail" title="API request" copy={id}>
      <OpsDetailShell
        backHref="/logs/api"
        backLabel="Back to API requests"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconHistory size={20} />}
            title={`${method} · ${service}`}
            status={(
              <Badge tone={toneForStatus(Number(status) < 400 ? "SUCCESS" : Number(status) < 500 ? "PENDING" : "FAILED")} dot>
                {status}
              </Badge>
            )}
            subtitle={id}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Status", value: status },
              { label: "Duration", value: duration },
              { label: "Direction", value: text(row, "direction") },
              { label: "Created", value: formatInstant(row.created_at ?? row.createdAt) },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: <IconId size={16} />,
            content: (
              <OpsDetailSection title="Request">
                <OpsDetailFacts
                  items={[
                    { label: "Id", value: text(row, "id") },
                    { label: "Correlation", value: text(row, "correlation_id", "correlationId") },
                    { label: "Direction", value: text(row, "direction") },
                    { label: "Service", value: service },
                    { label: "Actor", value: actorValue(actorType, actorId) },
                    { label: "Method", value: method },
                    { label: "URI", value: text(row, "request_uri", "requestUri") },
                    {
                      label: "Response status",
                      value: (
                        <Badge tone={toneForStatus(Number(status) < 400 ? "SUCCESS" : Number(status) < 500 ? "PENDING" : "FAILED")} dot>
                          {status}
                        </Badge>
                      ),
                    },
                    { label: "Duration", value: duration },
                    { label: "Remote address", value: text(row, "remote_address", "remoteAddress") },
                    { label: "Environment", value: text(row, "environment") },
                    {
                      label: "Error",
                      value: text(row, "error_type", "errorType") === "—"
                        ? "—"
                        : `${text(row, "error_type", "errorType")}: ${text(row, "error_message", "errorMessage")}`,
                    },
                    { label: "Created", value: formatInstant(row.created_at ?? row.createdAt) },
                  ]}
                />
              </OpsDetailSection>
            ),
          },
          {
            id: "request",
            label: "Request body",
            icon: <IconFileText size={16} />,
            content: (
              <OpsDetailSection title="Request body">
                <pre className="ops-payload">{preview(row.request_body ?? row.requestBody)}</pre>
              </OpsDetailSection>
            ),
          },
          {
            id: "response",
            label: "Response body",
            icon: <IconFileCode size={16} />,
            content: (
              <OpsDetailSection title="Response body">
                <pre className="ops-payload">{preview(row.response_body ?? row.responseBody)}</pre>
              </OpsDetailSection>
            ),
          },
        ]}
      />
    </OpsShell>
  );
}
