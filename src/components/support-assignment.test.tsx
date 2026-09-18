// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {afterEach,expect,it,vi} from "vitest";
import {SupportAssignment} from "./support-assignment";
afterEach(cleanup);
it("loads eligible agents and saves the chosen assignment and priority",async()=>{
  const request=vi.fn(async(path:string)=>path==="agents"?[{id:"agent-one",displayName:"Ada Support"}]:{}),onSaved=vi.fn();
  render(<SupportAssignment ticketId="ticket-one" assignedAdminId={null} priority="NORMAL" request={request} onSaved={onSaved}/>);
  await screen.findByRole("option",{name:"Ada Support"});
  fireEvent.change(screen.getByRole("combobox",{name:"Support agent"}),{target:{value:"agent-one"}});
  fireEvent.change(screen.getByRole("combobox",{name:"Priority"}),{target:{value:"HIGH"}});
  fireEvent.click(screen.getByRole("button",{name:"Save assignment"}));
  await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());
  expect(request).toHaveBeenCalledWith("tickets/ticket-one/assignment",{method:"POST",body:JSON.stringify({adminId:"agent-one",priority:"HIGH"})});
});
it("retains selections after a failed save",async()=>{
  const request=vi.fn(async(path:string)=>{if(path==="agents")return [];throw new Error("Could not save");});
  render(<SupportAssignment ticketId="ticket-one" assignedAdminId={null} priority="NORMAL" request={request} onSaved={vi.fn()}/>);
  await waitFor(()=>expect(screen.getByRole("combobox",{name:"Support agent"})).not.toBeDisabled());
  fireEvent.change(screen.getByRole("combobox",{name:"Priority"}),{target:{value:"URGENT"}});
  fireEvent.click(screen.getByRole("button",{name:"Save assignment"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
  expect(screen.getByRole("combobox",{name:"Priority"})).toHaveValue("URGENT");
});
