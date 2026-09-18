// @vitest-environment jsdom
import {cleanup,render,screen} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import type {ReactNode} from "react";
const mocks=vi.hoisted(()=>({requireAdmin:vi.fn(),adminBackend:vi.fn()}));
vi.mock("@/lib/admin-session.server",()=>mocks);
vi.mock("@/components/ops-shell",()=>({OpsShell:({children}:{children:ReactNode})=><main>{children}</main>}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error(url);},notFound:()=>{throw new Error("not-found");}}));
import Page from "./page";
const id="00000000-0000-0000-0000-000000000001",cursor="00000000-0000-0000-0000-000000000002";
const props=()=>({params:Promise.resolve({ticketId:id}),searchParams:Promise.resolve({})});
const context={activity:{kind:"RAMP",id},facts:{direction:"CRYPTO_TO_FIAT",status:"PROCESSING",sourceAsset:"ETH",sourceAmount:"10000000000000000.123456789",destinationAsset:"EUR",destinationAmount:null,createdAt:"2026-09-08T12:00:00Z"}};
beforeEach(()=>{vi.resetAllMocks();mocks.requireAdmin.mockResolvedValue({token:"test",principal:{permissions:["support.view","transactions.view"]}});});
afterEach(cleanup);
it("rejects missing transaction access before any linked data request",async()=>{
 mocks.requireAdmin.mockResolvedValue({token:"test",principal:{permissions:["support.view"]}});
 await expect(Page(props())).rejects.toThrow("/forbidden");expect(mocks.adminBackend).not.toHaveBeenCalled();
});
it("validates route and cursor identifiers before fetching",async()=>{
 await expect(Page({...props(),searchParams:Promise.resolve({before:"bad"})})).rejects.toThrow("not-found");
 expect(mocks.adminBackend).not.toHaveBeenCalled();
});
it("renders exact facts and cursor pagination with no payment controls",async()=>{
 mocks.adminBackend.mockResolvedValueOnce(Response.json(context)).mockResolvedValueOnce(Response.json({items:[{id:cursor,status:"PENDING",occurredAt:"2026-09-08T12:00:00Z"}],before:cursor,hasMore:true}));
 render(await Page(props()));
 expect(screen.getByText("10,000,000,000,000,000.123456789 ETH")).toBeInTheDocument();
 expect(screen.getByText("Not recorded")).toBeInTheDocument();
 expect(screen.getByRole("link",{name:"Back to conversation"})).toHaveAttribute("href",`/support?ticket=${id}`);
 expect(screen.getByRole("link",{name:"Older changes"})).toHaveAttribute("href",`/support/${id}/activity?before=${cursor}`);
 expect(screen.queryByRole("button")).not.toBeInTheDocument();
 expect(mocks.requireAdmin).toHaveBeenCalledWith("support.view",`/support/${id}/activity`);
});
it("shows an explicit history failure instead of an empty-history claim",async()=>{
 mocks.adminBackend.mockResolvedValueOnce(Response.json(context)).mockRejectedValueOnce(new Error("offline"));
 render(await Page(props()));expect(screen.getByRole("alert")).toHaveTextContent("History could not be loaded");
 expect(screen.queryByText("No recorded changes on this page.")).not.toBeInTheDocument();
});
it("does not query history for an unlinked request",async()=>{
 mocks.adminBackend.mockResolvedValue(Response.json({activity:null,facts:null}));
 render(await Page(props()));expect(screen.getByText("No linked transaction")).toBeInTheDocument();expect(mocks.adminBackend).toHaveBeenCalledTimes(1);
});
it("requires sign-in again if the backend session expires",async()=>{
 mocks.adminBackend.mockResolvedValue(new Response(null,{status:401}));
 await expect(Page(props())).rejects.toThrow("/login?");
});
