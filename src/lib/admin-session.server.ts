import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { backend, responseBody } from "./backend";
import { ACCESS_COOKIE, hasPermission, homePath, loginHref } from "./admin-access";
import type { AdminPrincipal } from "./admin-types";

export async function adminToken() {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function requireAdmin(permission?: string, returnTo = "/overview") {
  const token = await adminToken();
  if (!token) redirect(loginHref(returnTo));

  const response = await backend("/v1/admin/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await responseBody(response) as AdminPrincipal | { type?: string; title?: string } | null;

  if (response.status === 401) redirect(loginHref(returnTo, "session-expired"));
  if (!response.ok || !data || !("adminId" in data)) {
    redirect("/forbidden");
  }

  const principal = data as AdminPrincipal;
  if (permission && !hasPermission(principal.permissions, permission)) {
    redirect("/forbidden");
  }

  return { token, principal };
}

export async function signedInHome() {
  const token = await adminToken();
  if (!token) return "/login";
  const response = await backend("/v1/admin/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return "/login";
  const principal = await responseBody(response) as AdminPrincipal | null;
  return homePath(principal?.permissions);
}

export async function adminBackend(token: string, path: string, init: RequestInit = {}) {
  return backend(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...init.headers },
  });
}
