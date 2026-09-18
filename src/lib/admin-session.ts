"use client";

import { loginHref } from "./admin-access";

const ADMIN_AUTH_FAILURES = new Set([
  "authentication_failed",
  "authentication_required",
  "admin_session_expired",
]);

let redirecting = false;

export async function isAdminAuthFailure(response: Response) {
  if (response.status !== 401) return false;
  const problem = await response.clone().json().catch(() => null) as {
    type?: string;
    title?: string;
  } | null;
  return Boolean(
    problem && (
      ADMIN_AUTH_FAILURES.has(problem.type ?? "") ||
      problem.title === "Authentication failed" ||
      problem.title === "Administrator session is expired or revoked" ||
      problem.title === "A valid bearer token is required"
    ),
  );
}

function moveToLogin() {
  if (redirecting || typeof window === "undefined") return;
  redirecting = true;
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.replace(loginHref(returnTo, "session-expired"));
}

export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const request = { ...init, credentials: init.credentials ?? "same-origin" } satisfies RequestInit;
  const response = await fetch(input, request);
  if (!await isAdminAuthFailure(response)) return response;
  moveToLogin();
  if (typeof window !== "undefined") return new Promise<Response>(() => {});
  return response;
}
