// @vitest-environment jsdom
import {act,cleanup,render,screen,waitFor} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import type {SupportConnectionOptions} from "@/lib/support-connection";
const mocks=vi.hoisted(()=>({fetch:vi.fn(),connect:vi.fn((_options:SupportConnectionOptions&{scope:string})=>vi.fn())}));
vi.mock("@/lib/admin-session",()=>({adminFetch:mocks.fetch}));
vi.mock("@/lib/support-shared-connection",()=>({connectSharedSupport:mocks.connect}));
import {SupportUnreadBadge} from "./support-unread-badge";
beforeEach(()=>{mocks.fetch.mockReset();mocks.connect.mockClear();});
afterEach(cleanup);
it("loads the unread count when an update arrives and clears stale counts offline",async()=>{
 mocks.fetch.mockResolvedValue({ok:true,json:async()=>({unreadMessages:123})});
 render(<SupportUnreadBadge scope="BUSINESS"/>);
 expect(screen.getByLabelText("Unread support count unavailable")).toBeInTheDocument();
 act(()=>mocks.connect.mock.calls[0][0].onChange());
 expect(await screen.findByLabelText("123 unread support messages")).toHaveTextContent("99+");
 expect(mocks.fetch.mock.calls[0][1].headers["X-StrivePay-Account-Scope"]).toBe("BUSINESS");
 act(()=>mocks.connect.mock.calls[0][0].onState("offline"));
 expect(screen.queryByLabelText("123 unread support messages")).not.toBeInTheDocument();
 expect(screen.getByLabelText("Unread support count unavailable")).toBeInTheDocument();
});
it("does not pretend a failed request is zero unread",async()=>{
 mocks.fetch.mockResolvedValue({ok:false});
 render(<SupportUnreadBadge/>);
 act(()=>mocks.connect.mock.calls[0][0].onChange());
 await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledOnce());
 expect(screen.getByLabelText("Unread support count unavailable")).toBeInTheDocument();
});
it("releases the subscription and aborts pending fetch on unmount",()=>{
 mocks.fetch.mockReturnValue(new Promise(()=>{}));
 const view=render(<SupportUnreadBadge/>);
 act(()=>mocks.connect.mock.calls[0][0].onChange());
 const signal=mocks.fetch.mock.calls[0][1].signal;
 view.unmount();
 expect(signal.aborted).toBe(true);
 expect(mocks.connect.mock.results[0].value).toHaveBeenCalledOnce();
});
