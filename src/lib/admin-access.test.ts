import { describe, expect, it } from "vitest";
import {
  canSeeOverview,
  hasPermission,
  homePath,
  loginHref,
  loginSchema,
  safeReturnTo,
  signedInLanding,
} from "./admin-access";

describe("admin access contracts", () => {
  it("keeps only same-origin return paths", () => {
    expect(safeReturnTo("/customers?status=ACTIVE")).toBe("/customers?status=ACTIVE");
    expect(safeReturnTo(["/sessions", "/overview"])).toBe("/sessions");
    expect(safeReturnTo("//evil.example/steal")).toBe("/overview");
    expect(safeReturnTo("https://evil.example/steal")).toBe("/overview");
    expect(safeReturnTo(undefined)).toBe("/overview");
  });

  it("builds a safe expired-session login route", () => {
    expect(loginHref("/customers/abc", "session-expired"))
      .toBe("/login?returnTo=%2Fcustomers%2Fabc&reason=session-expired");
    expect(loginHref("https://evil.example/steal", "session-expired"))
      .toBe("/login?returnTo=%2Foverview&reason=session-expired");
    expect(loginHref("/fees")).toBe("/login?returnTo=%2Ffees");
  });

  it("lands signed-in users on returnTo or root home resolution", () => {
    expect(signedInLanding("/treasury")).toBe("/treasury");
    expect(signedInLanding(null)).toBe("/");
    expect(signedInLanding("/overview")).toBe("/overview");
    expect(signedInLanding("//evil")).toBe("/");
  });

  it("does not apply password complexity during login", () => {
    expect(loginSchema.safeParse({ email: "admin@strivepay.local", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "admin@strivepay.local", password: "" }).success).toBe(false);
  });

  it("gates overview and home path by permission slugs", () => {
    expect(canSeeOverview(["customers.view"])).toBe(false);
    expect(canSeeOverview(["coverage.view"])).toBe(true);
    expect(hasPermission(["customers.view"], "customers.view")).toBe(true);
    expect(homePath(["customers.view"])).toBe("/customers");
    expect(homePath(["transactions.view"])).toBe("/overview");
    expect(homePath(["support.view"])).toBe("/support");
    expect(homePath(["admins.manage"])).toBe("/team");
    expect(homePath(["webhooks.view"])).toBe("/webhooks");
    expect(homePath([])).toBe("/forbidden");
  });
});
