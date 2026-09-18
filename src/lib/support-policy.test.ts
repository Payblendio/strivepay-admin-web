import {describe, expect, it} from "vitest";
import {supportRouteAllowed, supportSocketUrl} from "./support-policy";
const id = "00000000-0000-0000-0000-000000000001";
describe("support proxy policy", () => {
  it("restricts audit events to admin reads",()=>{
    expect(supportRouteAllowed(`tickets/${id}/events`,"GET",true)).toBe(true);
    expect(supportRouteAllowed(`tickets/${id}/events`,"GET",false)).toBe(false);
    expect(supportRouteAllowed(`tickets/${id}/events`,"POST",true)).toBe(false);
    expect(supportRouteAllowed("tickets/invalid/events","GET",true)).toBe(false);
  });
  it("allows only well-formed linked-activity reads",()=>{
    for(const admin of [false,true]){
      expect(supportRouteAllowed(`tickets/${id}/activity`,"GET",admin)).toBe(true);
      for(const method of ["POST","PUT","DELETE"])expect(supportRouteAllowed(`tickets/${id}/activity`,method,admin)).toBe(false);
      expect(supportRouteAllowed("tickets/not-a-uuid/activity","GET",admin)).toBe(false);
    }
  });
  it("allows only reads of the unread summary", () => {
    for (const admin of [false,true]) {
      expect(supportRouteAllowed("unread","GET",admin)).toBe(true);
      expect(supportRouteAllowed("unread","POST",admin)).toBe(false);
      expect(supportRouteAllowed("unread","DELETE",admin)).toBe(false);
    }
  });
  it("allows scoped customer reads and writes", () => {
    expect(supportRouteAllowed("tickets", "POST")).toBe(true);
    expect(supportRouteAllowed(`tickets/${id}/messages`, "POST")).toBe(true);
    expect(supportRouteAllowed("socket-ticket", "POST")).toBe(true);
  });
  it("keeps assignment admin-only and rejects unknown routes", () => {
    expect(supportRouteAllowed(`tickets/${id}/context`, "GET", true)).toBe(true);
    expect(supportRouteAllowed(`tickets/${id}/context`, "GET")).toBe(false);
    expect(supportRouteAllowed(`tickets/${id}/context`, "POST", true)).toBe(false);
    expect(supportRouteAllowed(`tickets/${id}/attachments`, "GET")).toBe(true);
    expect(supportRouteAllowed(`tickets/${id}/messages/${id}/attachments/${id}`, "POST")).toBe(true);
    expect(supportRouteAllowed(`tickets/${id}/attachments/${id}`, "POST")).toBe(false);
    expect(supportRouteAllowed("agents", "GET", true)).toBe(true);
    expect(supportRouteAllowed("agents", "GET")).toBe(false);
    expect(supportRouteAllowed("agents", "POST", true)).toBe(false);
    expect(supportRouteAllowed(`tickets/${id}/assignment`, "POST")).toBe(false);
    expect(supportRouteAllowed(`tickets/${id}/assignment`, "POST", true)).toBe(true);
    expect(supportRouteAllowed("tickets", "POST", true)).toBe(false);
    for (const route of ["../customers", "tickets/anything", "socket", "tickets/../../admin"]) expect(supportRouteAllowed(route, "GET")).toBe(false);
    expect(supportRouteAllowed(`tickets/${id}`, "DELETE", true)).toBe(false);
  });
  it("derives the local socket address only for local pages", () => {
    expect(supportSocketUrl("http://localhost:18081")).toBe("ws://localhost:18080/v1/support/socket");
    expect(() => supportSocketUrl("https://strivepay.example")).toThrow();
  });
  it("requires secure remote sockets and rejects embedded credentials", () => {
    expect(supportSocketUrl("https://strivepay.example", "wss://api.strivepay.example/v1/support/socket")).toBe("wss://api.strivepay.example/v1/support/socket");
    for (const url of ["ws://api.strivepay.example/v1/support/socket", "wss://secret@api.strivepay.example/v1/support/socket", "wss://api.strivepay.example/v1/support/socket?token=x", "https://api.strivepay.example/v1/support/socket"]) expect(() => supportSocketUrl("https://strivepay.example", url)).toThrow();
  });
});
