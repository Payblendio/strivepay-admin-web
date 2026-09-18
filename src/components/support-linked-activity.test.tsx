// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {afterEach,expect,it,vi} from "vitest";
import {SupportLinkedActivity} from "./support-linked-activity";
afterEach(cleanup);
const id="00000000-0000-0000-0000-000000000001";
it("refreshes transaction facts independently and clears them on failure",async()=>{
 let fail!:(reason:Error)=>void;
 const request=vi.fn().mockResolvedValueOnce({activity:{kind:"ORDER",id}}).mockImplementationOnce(()=>new Promise((_,reject)=>{fail=reject;}));
 render(<SupportLinkedActivity ticketId={id} revision={0} request={request}/>);
 fireEvent.click(await screen.findByRole("button",{name:"Refresh transaction"}));
 expect(screen.getByRole("complementary")).toHaveAttribute("aria-busy","true");
 expect(screen.getByRole("button",{name:"Refreshing transaction…"})).toBeDisabled();
 await act(async()=>fail(new Error("offline")));
 expect(await screen.findByRole("alert")).toBeInTheDocument();
 expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("hides the old reference immediately when switching tickets and ignores late responses",async()=>{
 const second="00000000-0000-0000-0000-000000000002";
 let finish!:(value:unknown)=>void;
 const request=vi.fn().mockResolvedValueOnce({activity:{kind:"ORDER",id}}).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce({activity:null});
 const view=render(<SupportLinkedActivity ticketId={id} revision={0} request={request}/>);
 await screen.findByRole("link");
 view.rerender(<SupportLinkedActivity ticketId={second} revision={0} request={request}/>);
 expect(screen.queryByRole("link")).not.toBeInTheDocument();
 expect(screen.getByRole("status")).toHaveTextContent("Loading linked transaction");
 view.rerender(<SupportLinkedActivity ticketId={id} revision={1} request={request}/>);
 await act(async()=>finish({activity:{kind:"ORDER",id:second}}));
 await vi.waitFor(()=>expect(screen.queryByRole("status")).not.toBeInTheDocument());
 expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("shows current facts without inventing an unrecorded destination amount",async()=>{
 const request=vi.fn().mockResolvedValue({activity:{kind:"CONVERSION",id},facts:{direction:"NGN_TO_CRYPTO",status:"PROCESSING",sourceAsset:"NGN",sourceAmount:"1000",destinationAsset:"ETH",destinationAmount:null,createdAt:"2026-09-08T12:00:00Z"}});
 render(<SupportLinkedActivity ticketId={id} revision={0} request={request}/>);
 expect(await screen.findByText("PROCESSING")).toBeInTheDocument();
 expect(screen.getByText("1,000 NGN")).toBeInTheDocument();
 expect(screen.getByText("Not recorded")).toBeInTheDocument();
 expect(screen.getByRole("link")).toHaveAttribute("href",`/support/${id}/activity`);
});
it("rejects malformed transaction facts rather than rendering a misleading summary",async()=>{
 const request=vi.fn().mockResolvedValue({activity:{kind:"ORDER",id},facts:{status:"COMPLETED"}});
 render(<SupportLinkedActivity ticketId={id} revision={0} request={request}/>);
 expect(await screen.findByRole("alert")).toBeInTheDocument();
 expect(screen.queryByText("COMPLETED")).not.toBeInTheDocument();
});
it("preserves all decimal digits without converting amounts to floating point",async()=>{
 const request=vi.fn().mockResolvedValue({activity:{kind:"RAMP",id},facts:{direction:"CRYPTO_TO_FIAT",status:"PROCESSING",sourceAsset:"ETH",sourceAmount:"12345678901234567890.123456789012345678",destinationAsset:"EUR",destinationAmount:"0",createdAt:"2026-09-08T12:00:00Z"}});
 render(<SupportLinkedActivity ticketId={id} revision={0} request={request}/>);
 expect(await screen.findByText("12,345,678,901,234,567,890.123456789012345678 ETH")).toBeInTheDocument();
 expect(screen.getByText("0 EUR")).toBeInTheDocument();
});
it("renders a validated order link in a separate tab",async()=>{
 const request=vi.fn().mockResolvedValue({activity:{kind:"ORDER",id}});
 render(<SupportLinkedActivity ticketId={id} revision={0} request={request}/>);
 expect(await screen.findByRole("link")).toHaveAttribute("href","/transactions/"+id);
 expect(screen.getByRole("link")).toHaveAttribute("target","_blank");
});
it("hides generic requests and recovers a failed lookup",async()=>{
 const request=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({activity:null});
 render(<SupportLinkedActivity ticketId={id} revision={0} request={request}/>);
 fireEvent.click(await screen.findByRole("button",{name:"Retry transaction"}));
 await vi.waitFor(()=>expect(screen.queryByRole("alert")).not.toBeInTheDocument());
 expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});
it("rejects untrusted link identifiers",async()=>{
 const request=vi.fn().mockResolvedValue({activity:{kind:"ORDER",id:"https://foreign.invalid"}});
 render(<SupportLinkedActivity ticketId={id} revision={0} request={request}/>);
 expect(await screen.findByRole("alert")).toBeInTheDocument();
 expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
