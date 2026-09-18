// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {afterEach,expect,it,vi} from "vitest";
import {SupportAuditTrail} from "./support-audit-trail";
afterEach(cleanup);
const event=(id:number,type="ticket.created")=>({id,type,actorType:"ADMIN",actorName:"QA agent",createdAt:"2026-09-08T12:00:00Z",status:null,priority:null,assignedAdminId:null});
function expand(){const details=screen.getByText("Staff activity history").closest("details")!;details.open=true;fireEvent(details,new Event("toggle"));}
it("loads only when expanded and pages older events",async()=>{
 const request=vi.fn().mockResolvedValueOnce({items:[event(3)],before:3,hasMore:true}).mockResolvedValueOnce({items:[event(2,"note.created")],before:null,hasMore:false});
 render(<SupportAuditTrail ticketId="ticket" revision={0} request={request}/>);
 expect(request).not.toHaveBeenCalled();expand();
 expect(await screen.findByText("Conversation opened")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Load older activity"}));
 expect(await screen.findByText("Internal note added")).toBeInTheDocument();
 expect(request.mock.calls[1][0]).toBe("tickets/ticket/events?size=30&before=3");
 expect(screen.getByText("Conversation opened")).toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"Load older activity"})).not.toBeInTheDocument();
});
it("recovers failed history without presenting it as an empty result",async()=>{
 const request=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({items:[],before:null,hasMore:false});
 render(<SupportAuditTrail ticketId="ticket" revision={0} request={request}/>);expand();
 fireEvent.click(await screen.findByRole("button",{name:"Retry history"}));
 expect(await screen.findByText("No activity recorded.")).toBeInTheDocument();
 expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("renders stored change details and preserves unknown historical entries",async()=>{
 const request=vi.fn().mockResolvedValue({items:[{...event(3,"ticket.status"),status:"IN_PROGRESS"},{...event(2,"ticket.assigned"),priority:"HIGH"},event(1,"legacy.event")],before:null,hasMore:false});
 render(<SupportAuditTrail ticketId="ticket" revision={0} request={request}/>);expand();
 expect(await screen.findByText("Status: IN PROGRESS")).toBeInTheDocument();
 expect(screen.getByText("Priority: high · Unassigned")).toBeInTheDocument();
 expect(screen.getByText("Support activity recorded")).toBeInTheDocument();
});
it("rejects malformed event pages",async()=>{
 const request=vi.fn().mockResolvedValue({items:[{id:1}],before:null,hasMore:false});
 render(<SupportAuditTrail ticketId="ticket" revision={0} request={request}/>);expand();
 expect(await screen.findByRole("alert")).toBeInTheDocument();
 expect(screen.queryByText("No activity recorded.")).not.toBeInTheDocument();
});
