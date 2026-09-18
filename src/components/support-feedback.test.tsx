// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {afterEach,expect,it,vi} from "vitest";
import {SupportFeedback} from "./support-feedback";
afterEach(cleanup);
it("saves a rating and optional comment",async()=>{
 const request=vi.fn(async(_path:string,init?:RequestInit)=>init?.method==="POST"?{actorId:"one",rating:4,comment:"Helpful",createdAt:"2026-09-08T12:00:00Z"}:[]);
 render(<SupportFeedback ticketId="ticket" revision={0} request={request}/>);
 const rating=await screen.findByRole("combobox",{name:"Rating"});
 fireEvent.change(rating,{target:{value:"4"}});
 fireEvent.change(screen.getByRole("textbox",{name:"Comment (optional)"}),{target:{value:"Helpful"}});
 fireEvent.click(screen.getByRole("button",{name:"Send feedback"}));
 expect(await screen.findByRole("status")).toHaveTextContent("Your feedback has been saved");
 expect(request).toHaveBeenCalledWith("tickets/ticket/feedback",{method:"POST",body:JSON.stringify({rating:4,comment:"Helpful"})});
});
it("shows admin feedback without editing controls",async()=>{
 const request=vi.fn(async()=>[{actorId:"one",rating:5,comment:"Resolved quickly",createdAt:"2026-09-08T12:00:00Z"}]);
 render(<SupportFeedback ticketId="ticket" revision={0} readOnly request={request}/>);
 expect(await screen.findByText("Resolved quickly")).toBeInTheDocument();
 expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"Send feedback"})).not.toBeInTheDocument();
});
it("keeps the form values after a failed save",async()=>{
 const request=vi.fn(async(_path:string,init?:RequestInit)=>{if(init?.method==="POST")throw new Error("Please retry");return [];});
 render(<SupportFeedback ticketId="ticket" revision={0} request={request}/>);
 fireEvent.change(await screen.findByRole("combobox",{name:"Rating"}),{target:{value:"2"}});
 fireEvent.change(screen.getByRole("textbox"),{target:{value:"Still need help"}});
 fireEvent.click(screen.getByRole("button",{name:"Send feedback"}));
 await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("Please retry"));
 expect(screen.getByRole("textbox")).toHaveValue("Still need help");
 expect(screen.getByRole("combobox")).toHaveValue("2");
});

