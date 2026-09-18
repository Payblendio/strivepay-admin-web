"use client";
import { OpsAccountMenu } from "./ops-account-menu";
import {SupportUnreadBadge} from "./support-unread-badge";
import {confirmSupportLeave} from "@/lib/use-support-unload-warning";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  IconLayoutDashboard,
  IconLogout,
  IconMenu2,
  IconShieldLock,
  IconUsers,
  IconX,
  IconArrowsExchange,
  IconWebhook,
  IconTestPipe,
  IconMessageCircle,
  IconCoin,
  IconBuildingBank,
  IconUserShield,
  IconClipboardList,
  IconHistory,
  IconRoute,
  IconScale,
  IconBell,
  IconFileText,
  IconWorldWww,
  IconWallet,
  IconCashBanknote,
} from "@tabler/icons-react";
import { canSeeOverview, hasPermission, homePath, PERMISSIONS } from "@/lib/admin-access";
import { adminFetch } from "@/lib/admin-session";
import type { AdminPrincipal } from "@/lib/admin-types";
import { initials } from "@/lib/values";

const HEARTBEAT_MS = 4 * 60 * 1000;

type OpsShellProps = {
  principal: AdminPrincipal;
  eyebrow: string;
  title: string;
  copy: string;
  children: ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number }>;
  hint: string;
  visible: (permissions: Iterable<string>) => boolean;
};

type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Desk",
    items: [
      { label: "Overview", href: "/overview", icon: IconLayoutDashboard, hint: "Fees & readiness", visible: canSeeOverview },
      { label: "Support", href: "/support", icon: IconMessageCircle, hint: "Customer threads", visible: (p) => hasPermission(p, PERMISSIONS.supportView) },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Transactions", href: "/transactions", icon: IconArrowsExchange, hint: "Rails & profit", visible: (p) => hasPermission(p, PERMISSIONS.transactionsView) },
      { label: "Pay-in accounts", href: "/pay-in-accounts", icon: IconWallet, hint: "Collection rails", visible: (p) => hasPermission(p, PERMISSIONS.customersView) },
      { label: "Destination accounts", href: "/destination-accounts", icon: IconCashBanknote, hint: "Payout banks", visible: (p) => hasPermission(p, PERMISSIONS.customersView) },
      { label: "Fees & FX", href: "/fees", icon: IconCoin, hint: "Rules & majors", visible: (p) => hasPermission(p, PERMISSIONS.feesView) },
      { label: "Treasury", href: "/treasury", icon: IconBuildingBank, hint: "DOT & funding", visible: (p) => hasPermission(p, PERMISSIONS.treasuryView) },
      { label: "NGN masters", href: "/treasury/ngn-masters", icon: IconCashBanknote, hint: "Safe Haven masters", visible: (p) => hasPermission(p, PERMISSIONS.treasuryView) },
      { label: "Quidax", href: "/quidax", icon: IconCoin, hint: "Parent wallets & swap", visible: (p) => hasPermission(p, PERMISSIONS.treasuryView) },
      { label: "Corridors", href: "/corridors", icon: IconRoute, hint: "Settlement paths", visible: (p) => hasPermission(p, PERMISSIONS.coverageView) },
      { label: "Reconciliation", href: "/reconciliation", icon: IconScale, hint: "Mismatch queue", visible: (p) => hasPermission(p, PERMISSIONS.coverageView) },
    ],
  },
  {
    label: "Customers",
    items: [
      { label: "Customers", href: "/customers", icon: IconUsers, hint: "Accounts", visible: (p) => hasPermission(p, PERMISSIONS.customersView) },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Webhooks", href: "/webhooks", icon: IconWebhook, hint: "Provider events", visible: (p) => hasPermission(p, PERMISSIONS.webhooksView) },
      { label: "Business webhooks", href: "/business-webhooks", icon: IconWorldWww, hint: "Merchant deliveries", visible: (p) => hasPermission(p, PERMISSIONS.webhooksView) },
      { label: "Notifications", href: "/notifications", icon: IconBell, hint: "Delivery retries", visible: (p) => hasPermission(p, PERMISSIONS.notificationsView) },
      { label: "Compliance", href: "/compliance", icon: IconFileText, hint: "Legal documents", visible: (p) => hasPermission(p, PERMISSIONS.complianceManage) },
      { label: "Audit log", href: "/logs", icon: IconClipboardList, hint: "Admin actions", visible: (p) => hasPermission(p, PERMISSIONS.auditView) },
      { label: "API requests", href: "/logs/api", icon: IconHistory, hint: "Request trail", visible: (p) => hasPermission(p, PERMISSIONS.auditView) },
      { label: "Sandbox", href: "/sandbox", icon: IconTestPipe, hint: "Simulated rails", visible: (p) => hasPermission(p, PERMISSIONS.sandboxManage) },
    ],
  },
  {
    label: "Access",
    items: [
      { label: "Team", href: "/team", icon: IconUserShield, hint: "Operators", visible: (p) => hasPermission(p, PERMISSIONS.adminsManage) },
      { label: "Roles", href: "/roles", icon: IconShieldLock, hint: "Permissions", visible: (p) => hasPermission(p, PERMISSIONS.rolesManage) },
    ],
  },
];

export function OpsShell({ principal, eyebrow, title, copy, children }: OpsShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.visible(principal.permissions)) }))
    .filter((group) => group.items.length > 0);
  const home = homePath(principal.permissions);
  const name = principal.displayName || principal.email;

  useEffect(() => {
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    let timer = 0;
    async function ping() {
      if (document.visibilityState !== "visible") return;
      const response = await adminFetch("/api/auth/me");
      if (response.status === 401) return;
    }
    function start() {
      window.clearInterval(timer);
      timer = window.setInterval(ping, HEARTBEAT_MS);
    }
    ping();
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, []);

  async function logout() {
    if (!(await confirmSupportLeave())) return;
    await adminFetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className={`dashboard-shell${menuOpen ? " menu-open" : ""}`}>
      <button className="dashboard-scrim" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />

      <aside className="dashboard-sidebar" id="dashboard-sidebar" aria-label="Operations navigation">
        <div className="dashboard-sidebar-brand">
          <Link href={home} aria-label="StrivePay operations">
            <Image className="ops-dark-logo" src="/branding/strivepay-logo-dark.svg" width={160} height={42} alt="StrivePay" priority />
          </Link>
          <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><IconX size={22} /></button>
        </div>

        <OpsAccountMenu name={name} email={principal.email} onSignOut={logout} />

        <nav className="dashboard-primary-nav" aria-label="Primary">
          {visibleGroups.map((group) => (
            <div className="dashboard-nav-group" key={group.label}>
              <span className="dashboard-nav-heading">{group.label}</span>
              {group.items.map((item) => {
                const active = item.href === "/logs"
                  ? pathname === "/logs" || pathname.startsWith("/logs?")
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    className={`dashboard-nav-item${active ? " active" : ""}`}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    <item.icon size={18} />
                    <span>
                      {item.label}
                      <small>{item.hint}</small>
                    </span>
                    {item.href === "/support" ? <SupportUnreadBadge /> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <nav className="dashboard-system-nav" aria-label="Account">
          <span className="dashboard-nav-heading">Account</span>
          <Link href="/sessions" onClick={() => setMenuOpen(false)}><IconShieldLock size={18} /><span>Sessions</span></Link>
          <button type="button" onClick={logout}><IconLogout size={18} /><span>Sign out</span></button>
        </nav>

        <div className="dashboard-sidebar-foot">
          <Image src="/branding/strivepay-mark.svg" alt="" width={20} height={24} />
          <span>Ops control</span>
          <i aria-hidden="true" />
        </div>
      </aside>

      <section className="dashboard-workspace">
        <header className="dashboard-header">
          <button className="dashboard-menu-button" type="button" aria-label="Open navigation" aria-controls="dashboard-sidebar" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <IconMenu2 size={23} />
          </button>
          <div className="dashboard-page-title">
            <span>{eyebrow}</span>
            <h1>{title}</h1>
            <p>{copy}</p>
          </div>
          <div className="ops-header-actions">
            <div className="dashboard-profile" aria-label={`Signed in as ${principal.email}`}>
              <span>{initials(name)}</span>
              <div>
                <strong>{name}</strong>
                <small>{principal.email}</small>
              </div>
            </div>
          </div>
        </header>
        <div className="ops-page">{children}</div>
      </section>
    </main>
  );
}
