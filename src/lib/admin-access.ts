import { z } from "zod";

export const ACCESS_COOKIE = "sp_admin_access";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(1, "Enter a reason for the audit trail"),
});

export const costValuationSchema = z.object({
  currency: z.string().trim().min(1, "Enter a currency"),
  amount: z.string().trim().min(1, "Enter an amount"),
  reason: z.string().trim().min(1, "Enter a reason for the audit trail"),
});

export function safeReturnTo(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/overview";
}

export function loginHref(returnTo: string, reason?: "session-expired") {
  const params = new URLSearchParams({ returnTo: safeReturnTo(returnTo) });
  if (reason) params.set("reason", reason);
  return `/login?${params.toString()}`;
}

/** Prefer deep-link returnTo; otherwise root resolves homePath via /me. */
export function signedInLanding(returnTo?: string | null) {
  const candidate = returnTo?.trim();
  if (candidate && candidate !== "/login" && candidate.startsWith("/") && !candidate.startsWith("//") && candidate !== "/overview") {
    return safeReturnTo(candidate);
  }
  if (candidate === "/overview") return "/overview";
  return "/";
}

export const PERMISSIONS = {
  supportView: "support.view",
  supportReply: "support.reply",
  supportNotes: "support.notes",
  supportManage: "support.manage",
  customersView: "customers.view",
  customersManage: "customers.manage",
  transactionsView: "transactions.view",
  transactionsManage: "transactions.manage",
  sandboxManage: "sandbox.manage",
  coverageView: "coverage.view",
  coverageManage: "coverage.manage",
  assetsView: "assets.view",
  assetsManage: "assets.manage",
  webhooksView: "webhooks.view",
  webhooksManage: "webhooks.manage",
  feesView: "fees.view",
  feesManage: "fees.manage",
  adminsManage: "admins.manage",
  rolesManage: "roles.manage",
  auditView: "audit.view",
  treasuryView: "treasury.view",
  treasuryManage: "treasury.manage",
  complianceManage: "compliance.manage",
  notificationsView: "notifications.view",
  notificationsManage: "notifications.manage",
} as const;

export function hasPermission(permissions: Iterable<string> | undefined, slug: string) {
  return Boolean(permissions && [...permissions].includes(slug));
}

export function canSeeOverview(permissions: Iterable<string> | undefined) {
  return hasPermission(permissions, PERMISSIONS.transactionsView)
    || hasPermission(permissions, PERMISSIONS.coverageView)
    || hasPermission(permissions, PERMISSIONS.feesView);
}

export function homePath(permissions: Iterable<string> | undefined) {
  if (canSeeOverview(permissions)) return "/overview";
  if (hasPermission(permissions, PERMISSIONS.supportView)) return "/support";
  if (hasPermission(permissions, PERMISSIONS.customersView)) return "/customers";
  if (hasPermission(permissions, PERMISSIONS.treasuryView)) return "/treasury";
  if (hasPermission(permissions, PERMISSIONS.webhooksView)) return "/webhooks";
  if (hasPermission(permissions, PERMISSIONS.notificationsView)) return "/notifications";
  if (hasPermission(permissions, PERMISSIONS.complianceManage)) return "/compliance";
  if (hasPermission(permissions, PERMISSIONS.adminsManage)) return "/team";
  if (hasPermission(permissions, PERMISSIONS.rolesManage)) return "/roles";
  if (hasPermission(permissions, PERMISSIONS.auditView)) return "/logs";
  return "/forbidden";
}
