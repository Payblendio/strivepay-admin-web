// @vitest-environment jsdom
import {cleanup,renderHook,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("./swal",()=>({confirmAction:vi.fn()}));
import {confirmAction} from "./swal";
import {confirmSupportLeave,useSupportUnloadWarning} from "./use-support-unload-warning";
afterEach(()=>{cleanup();document.body.replaceChildren();vi.restoreAllMocks();vi.clearAllMocks();});
function wouldWarn(){const event=new Event("beforeunload",{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}
it("guards explicit account actions without consuming draft protection",async()=>{
 const confirm=vi.mocked(confirmAction).mockResolvedValue(false);
 expect(await confirmSupportLeave()).toBe(true);expect(confirm).not.toHaveBeenCalled();
 const view=renderHook(()=>useSupportUnloadWarning(true));
 expect(await confirmSupportLeave()).toBe(false);expect(wouldWarn()).toBe(true);
 confirm.mockResolvedValue(true);expect(await confirmSupportLeave()).toBe(true);
 expect(wouldWarn()).toBe(true);view.unmount();expect(await confirmSupportLeave()).toBe(true);
});
function navigation(target="_self"){
 const link=document.createElement("a");link.href="/other-support-test-page";link.target=target;
 const label=document.createElement("span");label.textContent="Other page";link.append(label);document.body.append(link);
 const routed=vi.fn((event:Event)=>event.preventDefault());link.addEventListener("click",routed);
 return {link,routed,click:(extra:MouseEventInit={})=>label.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,button:0,...extra}))};
}
it("cancels internal navigation and allows it after confirmation",async()=>{
 const confirm=vi.mocked(confirmAction).mockResolvedValue(false);
 renderHook(()=>useSupportUnloadWarning(true));const link=navigation();
 link.click();expect(confirm).toHaveBeenCalledOnce();expect(link.routed).not.toHaveBeenCalled();
 await confirmSupportLeave();await new Promise(resolve=>setTimeout(resolve,0));
 confirm.mockResolvedValue(true);link.click();await waitFor(()=>expect(link.routed).toHaveBeenCalledOnce());
});
it("asks once when both composer and file picker contain unsent work",async()=>{
 const confirm=vi.mocked(confirmAction).mockResolvedValue(false);
 renderHook(()=>useSupportUnloadWarning(true));renderHook(()=>useSupportUnloadWarning(true));
 navigation().click();expect(confirm).toHaveBeenCalledOnce();
});
it("does not block a new tab, modified click, download or same-page anchor",async()=>{
 const confirm=vi.mocked(confirmAction).mockResolvedValue(false);
 renderHook(()=>useSupportUnloadWarning(true));
 navigation("_blank").click();navigation().click({ctrlKey:true});
 const download=navigation();download.link.download="proof";download.click();
 const anchor=navigation();anchor.link.href=window.location.href+"#messages";anchor.click();
 expect(confirm).not.toHaveBeenCalled();
});
it("removes the navigation guard when all pending work clears",async()=>{
 const confirm=vi.mocked(confirmAction).mockResolvedValue(false);
 const view=renderHook(({pending})=>useSupportUnloadWarning(pending),{initialProps:{pending:true}});
 view.rerender({pending:false});const link=navigation();link.click();
 expect(confirm).not.toHaveBeenCalled();expect(link.routed).toHaveBeenCalledOnce();
});
it("warns only while content is pending and cleans up on unmount",()=>{
 const view=renderHook(({pending})=>useSupportUnloadWarning(pending),{initialProps:{pending:false}});
 expect(wouldWarn()).toBe(false);
 view.rerender({pending:true});expect(wouldWarn()).toBe(true);
 view.rerender({pending:false});expect(wouldWarn()).toBe(false);
 view.rerender({pending:true});view.unmount();expect(wouldWarn()).toBe(false);
});
it("keeps another pending form protected when one form clears",()=>{
 const first=renderHook(()=>useSupportUnloadWarning(true));
 const second=renderHook(()=>useSupportUnloadWarning(true));
 first.unmount();expect(wouldWarn()).toBe(true);
 second.unmount();expect(wouldWarn()).toBe(false);
});
