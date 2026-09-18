import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconBuilding, IconId, IconChartBar, IconUsers } from "@tabler/icons-react";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { DataTable, TablePerson } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { loadList } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, formatInstant, initials, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, principal } = await requireAdmin(PERMISSIONS.customersView, `/customers/${id}`);
  const response = await adminBackend(token, `/v1/admin/customers/${id}`);
  if (response.status === 400 || response.status === 404) notFound();
  if (!response.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Party directory" title="Customer" copy={id}>
        <EmptyState title="Customer unavailable" description="This customer could not be loaded. Refresh and try again." />
      </OpsShell>
    );
  }
  const row = asRecord(await responseBody(response));
  const name = text(row, "name");
  const partyType = text(row, "party_type", "partyType").toUpperCase();
  const isOrg = partyType === "ORGANIZATION";
  const email = text(row, "email");
  const ownerEmail = text(row, "owner_email", "ownerEmail");
  const ownerName = text(row, "owner_name", "ownerName");
  const ownerId = text(row, "owner_party_id", "ownerPartyId");
  const status = text(row, "status");
  const title = name === "—" ? "Customer" : name;
  const contactLabel = isOrg ? "Owner email" : "Email";
  const contactValue = isOrg
    ? (ownerEmail !== "—" ? ownerEmail : email)
    : email;
  const pageCopy = isOrg
    ? (contactValue !== "—" ? `Owner · ${contactValue}` : "Organization account")
    : email;

  const membersResponse = isOrg
    ? await adminBackend(token, `/v1/admin/customers/${id}/members`)
    : null;
  const membersLoad = membersResponse ? await loadList(membersResponse) : null;
  const members = membersLoad?.rows ?? [];

  return (
    <OpsShell principal={principal} eyebrow="Party directory" title={title} copy={pageCopy}>
      <OpsDetailShell
        backHref="/customers"
        backLabel="Back to customers"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconBuilding size={20} />}
            title={title}
            status={<Badge tone={toneForStatus(status)} dot>{status}</Badge>}
            subtitle={id}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Type", value: partyType || "—" },
              { label: "Status", value: status },
              { label: contactLabel, value: contactValue },
              ...(isOrg ? [
                { label: "Owner", value: ownerName },
                { label: "Members", value: text(row, "member_count", "memberCount") },
              ] : []),
              { label: "Onboarding", value: text(row, "onboarding_status", "onboardingStatus") },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: <IconId size={16} />,
            content: (
              <OpsDetailSection title="Profile">
                <OpsDetailFacts
                  items={[
                    { label: "Party id", value: text(row, "id") },
                    { label: "Type", value: partyType || "—" },
                    { label: "Status", value: <Badge tone={toneForStatus(status)} dot>{status}</Badge> },
                    { label: contactLabel, value: contactValue },
                    ...(isOrg ? [
                      {
                        label: "Owner",
                        value: ownerId !== "—" ? (
                          <Link className="ops-link" href={`/customers/${ownerId}`}>
                            {ownerName !== "—" ? ownerName : ownerId.slice(0, 8)}
                            {ownerEmail !== "—" ? ` · ${ownerEmail}` : ""}
                          </Link>
                        ) : "No owner linked",
                      },
                      { label: "Members", value: text(row, "member_count", "memberCount") },
                    ] : [
                      { label: "Phone", value: text(row, "phone_e164", "phoneE164") },
                    ]),
                    { label: "Country", value: text(row, "country_of_residence", "countryOfResidence") },
                    { label: "Registration number", value: text(row, "registration_number", "registrationNumber") },
                    { label: "Onboarding", value: text(row, "onboarding_status", "onboardingStatus") },
                    { label: "Compliance", value: text(row, "compliance_status", "complianceStatus") },
                    { label: "Entity status", value: text(row, "entity_status", "entityStatus") },
                    { label: "Provider entity", value: text(row, "provider_entity_id", "providerEntityId") },
                    { label: "Created", value: formatInstant(row.created_at ?? row.createdAt) },
                    { label: "Updated", value: formatInstant(row.updated_at ?? row.updatedAt) },
                  ]}
                />
              </OpsDetailSection>
            ),
          },
          ...(isOrg ? [{
            id: "members",
            label: "Members",
            icon: <IconUsers size={16} />,
            content: (
              <OpsDetailSection title="Members" kicker="Organization">
                {!membersLoad?.ok ? (
                  <EmptyState compact title="Members unavailable" description={membersLoad?.error || "Members could not be loaded."} />
                ) : (
                  <DataTable
                    columns={[
                      {
                        key: "member",
                        header: "Member",
                        render: (member) => {
                          const memberName = text(member, "name");
                          const memberEmail = text(member, "email");
                          const personId = text(member, "person_party_id", "personPartyId");
                          return (
                            <Link className="ops-link" href={`/customers/${personId}`}>
                              <TablePerson
                                initials={initials(memberName === "—" ? memberEmail : memberName)}
                                title={memberName === "—" ? memberEmail : memberName}
                                subtitle={memberEmail}
                              />
                            </Link>
                          );
                        },
                      },
                      { key: "role", header: "Role", render: (member) => text(member, "role") },
                      {
                        key: "status",
                        header: "Status",
                        render: (member) => <Badge tone={toneForStatus(text(member, "status"))} dot>{text(member, "status")}</Badge>,
                      },
                      { key: "link", header: "Provider link", render: (member) => text(member, "provider_link_status", "providerLinkStatus") },
                      { key: "activated", header: "Activated", render: (member) => formatInstant(member.activated_at ?? member.activatedAt) },
                    ]}
                    rows={members}
                    getKey={(member) => text(member, "membership_id", "membershipId", "person_party_id", "personPartyId")}
                    empty={<EmptyState compact title="No members" description="This organization has no active memberships yet." />}
                  />
                )}
              </OpsDetailSection>
            ),
          }] : []),
          {
            id: "volume",
            label: "Volume",
            icon: <IconChartBar size={16} />,
            content: (
              <OpsDetailSection title="Related volume">
                <OpsDetailFacts
                  items={[
                    {
                      label: "Bakkt managed accounts",
                      value: (
                        <Link className="ops-link" href={`/pay-in-accounts?partyId=${id}`}>
                          {text(row, "bakktManagedAccounts")}
                        </Link>
                      ),
                    },
                    {
                      label: "Bakkt remote accounts",
                      value: (
                        <Link className="ops-link" href={`/destination-accounts?partyId=${id}`}>
                          {text(row, "bakktRemoteAccounts")}
                        </Link>
                      ),
                    },
                    {
                      label: "Bakkt transactions",
                      value: (
                        <Link className="ops-link" href={`/transactions?partyId=${id}&provider=BAKKT`}>
                          {text(row, "bakktTransactions")}
                        </Link>
                      ),
                    },
                    {
                      label: "Quidax transactions",
                      value: (
                        <Link className="ops-link" href={`/transactions?partyId=${id}&provider=QUIDAX`}>
                          {text(row, "quidaxTransactions")}
                        </Link>
                      ),
                    },
                  ]}
                />
                <p className="ops-detail-links">
                  <Link className="ops-link" href={`/transactions?partyId=${id}`}>View transactions</Link>
                  <Link className="ops-link" href={`/pay-in-accounts?partyId=${id}`}>Pay-in accounts</Link>
                  <Link className="ops-link" href={`/destination-accounts?partyId=${id}`}>Destination accounts</Link>
                </p>
              </OpsDetailSection>
            ),
          },
        ]}
      />
    </OpsShell>
  );
}
