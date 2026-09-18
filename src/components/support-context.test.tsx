// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {SupportContext} from "./support-context";
const context={partyId:"account-one",displayName:"Example Company",accountType:"ORGANIZATION",accountStatus:"ACTIVE",country:"GB",joinedAt:"2026-01-01T00:00:00Z",openConversations:2};
beforeEach(()=>vi.stubGlobal("matchMedia",()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("shows account context and opens its profile separately",async()=>{
 render(<SupportContext ticketId="ticket-one" revision={0} request={vi.fn(async()=>context)}/>);
 expect(await screen.findByRole("heading",{name:"Example Company"})).toBeInTheDocument();
 expect(screen.getByText("Business")).toBeInTheDocument();
 expect(screen.getByRole("link",{name:/Open account/})).toHaveAttribute("href","/customers/account-one");
 expect(screen.getByRole("link",{name:/Open account/})).toHaveAttribute("target","_blank");
 expect(screen.getByText("Account status is not a verification decision.")).toBeInTheDocument();
});
it("recovers from a failed context request",async()=>{
 const request=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(context);
 render(<SupportContext ticketId="ticket-one" revision={0} request={request}/>);
 expect(await screen.findByRole("alert")).toHaveTextContent("could not be updated");
 fireEvent.click(screen.getByRole("button",{name:"Retry context"}));
 expect(await screen.findByRole("heading",{name:"Example Company"})).toBeInTheDocument();
 expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
