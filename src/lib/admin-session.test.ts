import { afterEach, describe, expect, it, vi } from "vitest";
import { adminFetch } from "./admin-session";

function jsonResponse(status: number, value: unknown) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("admin session fetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns the original response when the session is valid", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { adminId: "1" }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await adminFetch("/api/admin/customers");

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("redirects to login on an expired administrator session and does not refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(401, { type: "authentication_failed", title: "Authentication failed" }));
    const replace = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { pathname: "/customers", search: "", replace } });

    const pending = adminFetch("/api/admin/customers");
    await Promise.race([pending, new Promise((resolve) => setTimeout(resolve, 20))]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login?returnTo=%2Fcustomers&reason=session-expired");
  });

  it("does not treat permission failures as session expiry", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(403, { type: "admin_scope_required" }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await adminFetch("/api/admin/customers");

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
