// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {SupportWorkspace} from "./support-workspace";
const mocks=vi.hoisted(()=>({fetch:vi.fn(),dispose:vi.fn()}));
vi.mock("./support-linked-activity",()=>({SupportLinkedActivity:()=>null}));
vi.mock("@/lib/admin-session",()=>({adminFetch:mocks.fetch}));
vi.mock("@/lib/support-connection",()=>({connectSupport:()=>mocks.dispose}));
const ticket={id:"00000000-0000-0000-0000-000000000001",number:42,subject:"Transfer question",category:"TRANSFER",status:"OPEN",updatedAt:"2026-09-08T12:00:00Z",unreadCount:1};
beforeEach(()=>{
 mocks.fetch.mockReset();mocks.dispose.mockReset();
 mocks.fetch.mockImplementation(async(url:string,init?:RequestInit)=>{
   const value=url.includes("/history")?{items:[],before:null,hasMore:false}:url.includes("/messages")?[]:url.endsWith(ticket.id)?ticket:url.includes("/read")?{}:[ticket];
   return {ok:true,status:200,json:async()=>value};
 });
});
afterEach(()=>{cleanup();window.history.replaceState(null,"","/");});
it("keeps the address aligned with selection without discarding in-memory drafts",async()=>{
 window.history.replaceState(null,"","/support");
 render(<SupportWorkspace permissions={["support.view","support.reply"]}/>);
 fireEvent.click(await screen.findByRole("button",{name:/Transfer question/}));
 fireEvent.change(await screen.findByRole("textbox",{name:"Reply"}),{target:{value:"Retain while browsing"}});
 expect(new URL(window.location.href).searchParams.get("ticket")).toBe(ticket.id);
 fireEvent.click(screen.getByRole("button",{name:"Conversations"}));expect(window.location.search).toBe("");
 fireEvent.click(screen.getByRole("button",{name:/Transfer question/}));
 expect(await screen.findByRole("textbox",{name:"Reply"})).toHaveValue("Retain while browsing");
});
it("opens a validated deep-linked conversation without selecting it from the first inbox page",async()=>{
 const original=mocks.fetch.getMockImplementation()!;
 mocks.fetch.mockImplementation(async(url:string,init?:RequestInit)=>url.includes("tickets?page")?{ok:true,status:200,json:async()=>[]}:original(url,init));
 render(<SupportWorkspace initialTicket={ticket.id} permissions={["support.view","support.reply"]}/>);
 expect(await screen.findByRole("heading",{name:"Transfer question"})).toBeInTheDocument();
 expect(await screen.findByRole("textbox",{name:"Reply"})).toBeInTheDocument();
 expect(mocks.fetch.mock.calls.some(([url])=>url.endsWith(`tickets/${ticket.id}`))).toBe(true);
});
it("ignores malformed deep-link identifiers without requesting a thread",async()=>{
 render(<SupportWorkspace initialTicket="../../customers" permissions={["support.view"]}/>);
 await screen.findByRole("button",{name:/Transfer question/});
 expect(mocks.fetch.mock.calls.some(([url])=>url.includes("../")||url.endsWith(`tickets/${ticket.id}`))).toBe(false);
});
it("keeps the open thread and its draft when selected again",async()=>{
 render(<SupportWorkspace permissions={["support.view","support.reply"]}/>);
 fireEvent.click(await screen.findByRole("button",{name:/Transfer question/}));
 const reply=await screen.findByRole("textbox",{name:"Reply"});
 fireEvent.change(reply,{target:{value:"Keep this draft"}});
 fireEvent.click(screen.getByRole("button",{name:/Transfer question/}));
 expect(screen.getByRole("heading",{name:"Transfer question"})).toBeInTheDocument();
 expect(screen.getByRole("textbox",{name:"Reply"})).toHaveValue("Keep this draft");
 expect(screen.queryByText("Loading conversation…")).not.toBeInTheDocument();
});
it("keeps a failed send visible when a background refresh succeeds",async()=>{
 render(<SupportWorkspace permissions={["support.view","support.reply"]}/>);
 fireEvent.click(await screen.findByRole("button",{name:/Transfer question/}));
 fireEvent.change(await screen.findByRole("textbox",{name:"Reply"}),{target:{value:"Please check this"}});
 const original=mocks.fetch.getMockImplementation()!;
 mocks.fetch.mockImplementation(async(url:string,init?:RequestInit)=>init?.method==="POST"&&url.endsWith("/messages")?{ok:false,status:503,json:async()=>({title:"Message delivery failed"})}:original(url,init));
 fireEvent.click(screen.getByRole("button",{name:"Send reply"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Message delivery failed");
 const previous=mocks.fetch.mock.calls.filter(([url])=>url.includes("tickets?page")).length;
 fireEvent.click(screen.getByRole("button",{name:"Refresh support"}));
 await waitFor(()=>expect(mocks.fetch.mock.calls.filter(([url])=>url.includes("tickets?page")).length).toBeGreaterThan(previous));
 expect(screen.getByRole("alert")).toHaveTextContent("Message delivery failed");
 expect(screen.getByRole("textbox",{name:"Reply"})).toHaveValue("Please check this");
});
it("shows inbox failures beside the list and recovers on retry",async()=>{
 const original=mocks.fetch.getMockImplementation()!;
 mocks.fetch.mockImplementation(async(url:string,init?:RequestInit)=>url.includes("tickets?page")?{ok:false,status:503,json:async()=>({title:"Inbox unavailable"})}:original(url,init));
 render(<SupportWorkspace/>);
 expect(await screen.findByRole("alert")).toHaveTextContent("Inbox unavailable");
 mocks.fetch.mockImplementation(original);
 fireEvent.click(screen.getByRole("button",{name:"Retry conversations"}));
 expect(await screen.findByRole("button",{name:/Transfer question/})).toBeInTheDocument();
 expect(screen.queryByText("Inbox unavailable")).not.toBeInTheDocument();
});
it("keeps one attachment and feedback panel through repeated updates",async()=>{
 const errors=vi.spyOn(console,"error").mockImplementation(()=>{});
 try{
  render(<SupportWorkspace permissions={["support.view","support.reply"]}/>);
  fireEvent.click(await screen.findByRole("button",{name:/Transfer question/}));
  await screen.findByRole("heading",{name:"Transfer question"});
  for(let i=0;i<3;i++){
   const before=mocks.fetch.mock.calls.length;
   fireEvent.click(screen.getByRole("button",{name:"Refresh support"}));
   await waitFor(()=>expect(mocks.fetch.mock.calls.length).toBeGreaterThan(before));
   expect(screen.getAllByRole("heading",{name:"Files"})).toHaveLength(1);
   expect(screen.getAllByRole("heading",{name:"Customer feedback"})).toHaveLength(1);
  }
  expect(errors.mock.calls.flat().join(" ")).not.toMatch(/same key/);
 }finally{errors.mockRestore();}
});
it("opens a conversation with its status and reply composer",async()=>{
 render(<SupportWorkspace permissions={["support.view","support.reply"]}/>);
 fireEvent.click(await screen.findByRole("button",{name:/Transfer question/}));
 expect(await screen.findByRole("heading",{name:"Transfer question"})).toBeInTheDocument();
 expect(screen.getByRole("textbox",{name:"Reply"})).toBeInTheDocument();
});
it("retains a failed reply and retries with the same message identifier",async()=>{
 render(<SupportWorkspace permissions={["support.view","support.reply"]}/>);
 fireEvent.click(await screen.findByRole("button",{name:/Transfer question/}));
 const input=await screen.findByRole("textbox",{name:"Reply"});
 fireEvent.change(input,{target:{value:"Please check my transfer"}});
 const original=mocks.fetch.getMockImplementation()!;
 mocks.fetch.mockImplementation(async(url:string,init?:RequestInit)=>init?.method==="POST"&&url.endsWith("/messages")?{ok:false,status:503,json:async()=>({title:"Try later"})}:original(url,init));
 fireEvent.click(screen.getByRole("button",{name:"Send reply"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Try later");
 expect(input).toHaveValue("Please check my transfer");
 fireEvent.click(screen.getByRole("button",{name:"Send reply"}));
 await waitFor(()=>expect(mocks.fetch.mock.calls.filter(([url,init])=>url.endsWith("/messages")&&init?.method==="POST")).toHaveLength(2));
 const sends=mocks.fetch.mock.calls.filter(([url,init])=>url.endsWith("/messages")&&init?.method==="POST");
 expect(JSON.parse(sends[0][1].body).clientMessageId).toBe(JSON.parse(sends[1][1].body).clientMessageId);
});
it("preserves loaded earlier history when new messages arrive",async()=>{
 const message=(sequence:number,body:string)=>({id:String(sequence),sequence,body,senderType:"ADMIN",internalNote:false,createdAt:ticket.updatedAt});
 mocks.fetch.mockImplementation(async(url:string)=>{
   const value=url.includes("/history")?(url.includes("before=")?{items:[message(1,"Earlier reply")],before:1,hasMore:false}:{items:[message(2,"Latest reply")],before:2,hasMore:true})
     :url.includes("/messages")?[message(3,"New reply")]:url.endsWith(ticket.id)?ticket:url.includes("/read")?{}:[ticket];
   return {ok:true,status:200,json:async()=>value};
 });
 render(<SupportWorkspace permissions={["support.view","support.reply"]}/>);
 fireEvent.click(await screen.findByRole("button",{name:/Transfer question/}));
 expect(await screen.findByText("Latest reply")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Load earlier messages"}));
 expect(await screen.findByText("Earlier reply")).toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"Load earlier messages"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Refresh support"}));
 expect(await screen.findByText("New reply")).toBeInTheDocument();
 expect(screen.getByText("Earlier reply")).toBeInTheDocument();
 expect(screen.getAllByText("Latest reply")).toHaveLength(1);
 expect(mocks.fetch.mock.calls.some(([url])=>url.includes("/messages?size=100&after=2"))).toBe(true);
});
it("submits a literal search to the scoped inbox",async()=>{
 render(<SupportWorkspace/>);
 fireEvent.change(screen.getByRole("searchbox",{name:"Find a conversation"}),{target:{value:"Transfer & payout"}});
 fireEvent.click(screen.getByRole("button",{name:"Search"}));
 await waitFor(()=>expect(mocks.fetch.mock.calls.some(([url])=>url.includes("q=Transfer%20%26%20payout"))).toBe(true));
 fireEvent.click(screen.getByRole("button",{name:"Clear search"}));
 expect(screen.getByRole("searchbox")).toHaveValue("");
});
it("restores an unsent reply after visiting another conversation",async()=>{
 const second={...ticket,id:"00000000-0000-0000-0000-000000000002",number:43,subject:"Account question"};
 mocks.fetch.mockImplementation(async(url:string)=>{
   const value=url.includes("/history")?{items:[],before:null,hasMore:false}:url.includes("/messages")?[]:url.endsWith(ticket.id)?ticket:url.endsWith(second.id)?second:url.includes("/read")?{}:[ticket,second];
   return {ok:true,status:200,json:async()=>value};
 });
 render(<SupportWorkspace permissions={["support.view","support.reply"]}/>);
 fireEvent.click(await screen.findByRole("button",{name:/Transfer question/}));
 fireEvent.change(await screen.findByRole("textbox",{name:"Reply"}),{target:{value:"Unsent transfer details"}});
 fireEvent.click(screen.getByRole("button",{name:/Account question/}));
 expect(await screen.findByRole("textbox",{name:"Reply"})).toHaveValue("");
 fireEvent.click(screen.getByRole("button",{name:/Transfer question/}));
 expect(await screen.findByRole("textbox",{name:"Reply"})).toHaveValue("Unsent transfer details");
});
it("keeps internal-note drafts separate from customer replies",async()=>{
 render(<SupportWorkspace permissions={["support.view","support.reply","support.notes"]}/>);
 fireEvent.click(await screen.findByRole("button",{name:/Transfer question/}));
 fireEvent.change(await screen.findByRole("textbox",{name:"Reply"}),{target:{value:"Public reply draft"}});
 fireEvent.click(screen.getByRole("checkbox"));
 expect(screen.getByRole("textbox",{name:"Add an internal note"})).toHaveValue("");
 fireEvent.change(screen.getByRole("textbox",{name:"Add an internal note"}),{target:{value:"Private investigation"}});
 fireEvent.click(screen.getByRole("checkbox"));
 expect(screen.getByRole("textbox",{name:"Reply"})).toHaveValue("Public reply draft");
 fireEvent.click(screen.getByRole("checkbox"));
 expect(screen.getByRole("textbox",{name:"Add an internal note"})).toHaveValue("Private investigation");
});
it("closes the real-time subscription on unmount",()=>{
 const view=render(<SupportWorkspace/>);view.unmount();expect(mocks.dispose).toHaveBeenCalled();
});
