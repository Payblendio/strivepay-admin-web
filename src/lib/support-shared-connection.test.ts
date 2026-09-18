import {expect,it,vi} from "vitest";
import type {SupportConnectionOptions} from "./support-connection";
const mocks=vi.hoisted(()=>({connect:vi.fn((_options:SupportConnectionOptions)=>vi.fn())}));
vi.mock("./support-connection",()=>({connectSupport:mocks.connect}));
import {connectSharedSupport} from "./support-shared-connection";
const listener=(scope:string)=>({scope,requestTicket:vi.fn(async()=>null),onState:vi.fn(),onChange:vi.fn()});
it("shares one connection and keeps it until the last subscriber leaves",()=>{
 mocks.connect.mockClear();
 const first=listener("personal"),second=listener("personal");
 const leaveFirst=connectSharedSupport(first),leaveSecond=connectSharedSupport(second);
 expect(mocks.connect).toHaveBeenCalledTimes(1);
 const events=mocks.connect.mock.calls[0][0],dispose=mocks.connect.mock.results[0].value;
 events.onState("connected");events.onChange();
 expect(first.onChange).toHaveBeenCalledOnce();expect(second.onChange).toHaveBeenCalledOnce();
 leaveFirst();expect(dispose).not.toHaveBeenCalled();
 events.onChange();expect(first.onChange).toHaveBeenCalledOnce();expect(second.onChange).toHaveBeenCalledTimes(2);
 leaveSecond();expect(dispose).toHaveBeenCalledOnce();
});
it("never shares state between account scopes",()=>{
 mocks.connect.mockClear();
 const first=listener("personal"),second=listener("business");
 const a=connectSharedSupport(first),b=connectSharedSupport(second);
 expect(mocks.connect).toHaveBeenCalledTimes(2);
 mocks.connect.mock.calls[0][0].onChange();
 expect(first.onChange).toHaveBeenCalledOnce();expect(second.onChange).not.toHaveBeenCalled();
 a();b();
});
it("clears watched activity when the conversation leaves but the badge remains",()=>{
 mocks.connect.mockClear();
 const a=connectSharedSupport(listener("watch"));
 const b=connectSharedSupport({...listener("watch"),activity:()=>({ticketId:"ticket-one",typing:true})});
 const events=mocks.connect.mock.calls[0][0];
 expect(events.activity?.()).toEqual({ticketId:"ticket-one",typing:true});
 b();expect(events.activity?.()).toEqual({ticketId:null,typing:false});a();
});
