import { describe, expect, it } from "vitest";
import { hasValidRequestOrigin, publicRequestOrigin } from "./request-origin";

describe("request origin validation", () => {
  it("uses the public Host header instead of Next.js's internal URL", () => {
    const headers = new Headers({ host: "localhost:18082" });

    expect(publicRequestOrigin(headers, "http://127.0.0.1:18082")).toBe("http://localhost:18082");
    expect(hasValidRequestOrigin("http://localhost:18082", headers, "http://127.0.0.1:18082")).toBe(true);
  });

  it("uses forwarded host and protocol behind a proxy", () => {
    const headers = new Headers({
      host: "admin-web:18082",
      "x-forwarded-host": "ops.strivepay.co",
      "x-forwarded-proto": "https",
    });

    expect(hasValidRequestOrigin("https://ops.strivepay.co", headers, "http://admin-web:18082")).toBe(true);
  });

  it("rejects cross-site and malformed origins", () => {
    const headers = new Headers({ host: "localhost:18082" });

    expect(hasValidRequestOrigin("https://example.com", headers, "http://127.0.0.1:18082")).toBe(false);
    expect(hasValidRequestOrigin("not an origin", headers, "http://127.0.0.1:18082")).toBe(false);
  });

  it("keeps non-browser requests without an Origin header working", () => {
    expect(hasValidRequestOrigin(null, new Headers(), "http://127.0.0.1:18082")).toBe(true);
  });
});
