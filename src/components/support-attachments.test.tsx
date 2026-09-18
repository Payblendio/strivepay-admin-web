// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {SupportAttachments} from "./support-attachments";
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock("@/lib/admin-session",()=>({adminFetch:mocks.fetch}));
afterEach(cleanup);beforeEach(()=>{mocks.fetch.mockReset();});
it("reports an active transfer to the conversation and releases it on failure",async()=>{
 let finish!:(value:unknown)=>void;
 mocks.fetch.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const request=vi.fn(async(path:string)=>path.endsWith("/attachments")?[]:{id:"message-one"});
 const onBusyChange=vi.fn();
 render(<SupportAttachments ticketId="ticket-one" revision={0} scope="PERSONAL" canUpload internal={false} request={request} onUploaded={vi.fn()} onBusyChange={onBusyChange}/>);
 fireEvent.change(screen.getByLabelText("Attach a file"),{target:{files:[new File(["image"],"proof.png",{type:"image/png"})]}});
 fireEvent.click(screen.getByRole("button",{name:"Upload file"}));
 await waitFor(()=>expect(mocks.fetch).toHaveBeenCalled());
 expect(onBusyChange).toHaveBeenLastCalledWith(true);
 finish({ok:false,json:async()=>({title:"Upload unavailable"})});
 await screen.findByRole("alert");
 await waitFor(()=>expect(onBusyChange).toHaveBeenLastCalledWith(false));
 expect(screen.getByRole("button",{name:"Retry upload"})).toBeEnabled();
});
it("distinguishes loading and failure from an empty file list and recovers",async()=>{
 const request=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
 render(<SupportAttachments ticketId="ticket-one" revision={0} scope="PERSONAL" canUpload={false} internal={false} request={request} onUploaded={vi.fn()}/>);
 expect(screen.getByRole("status")).toHaveTextContent("Loading files");
 expect(screen.queryByText("No files shared yet.")).not.toBeInTheDocument();
 expect(await screen.findByRole("alert")).toHaveTextContent("Files could not be loaded");
 expect(screen.queryByText("No files shared yet.")).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Reload files"}));
 expect(await screen.findByText("No files shared yet.")).toBeInTheDocument();
 expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("retries file transfer without creating a duplicate message",async()=>{
 const request=vi.fn(async(path:string)=>path.endsWith("/attachments")?[]:{id:"message-one"}),onUploaded=vi.fn();
 mocks.fetch.mockResolvedValueOnce({ok:false,json:async()=>({title:"Scanner unavailable"})}).mockResolvedValueOnce({ok:true});
 render(<SupportAttachments ticketId="ticket-one" revision={0} scope="PERSONAL" canUpload internal={false} request={request} onUploaded={onUploaded}/>);
 fireEvent.change(screen.getByLabelText("Attach a file"),{target:{files:[new File(["image"],"proof.png",{type:"image/png"})]}});
 fireEvent.click(screen.getByRole("button",{name:"Upload file"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("retry to attach");
 fireEvent.click(screen.getByRole("button",{name:"Retry upload"}));
 await waitFor(()=>expect(onUploaded).toHaveBeenCalledOnce());
 expect(request.mock.calls.filter(([path])=>path.endsWith("/messages"))).toHaveLength(1);
 expect(mocks.fetch.mock.calls[0][0]).toBe(mocks.fetch.mock.calls[1][0]);
 expect(mocks.fetch.mock.calls[0][1].headers["Content-Type"]).toBe("application/octet-stream");
});
it("does not offer upload to a read-only conversation",async()=>{
 const request=vi.fn(async()=>[{id:"file-one",messageId:"message-one",filename:"evidence.png",sizeBytes:1200,internalNote:true}]);
 render(<SupportAttachments ticketId="ticket-one" revision={0} scope="PERSONAL" canUpload={false} internal={false} request={request} onUploaded={vi.fn()}/>);
 expect(await screen.findByRole("button",{name:"evidence.png"})).toBeInTheDocument();
 expect(screen.getByText(/Staff only/)).toBeInTheDocument();
 expect(screen.queryByLabelText("Attach a file")).not.toBeInTheDocument();
});
