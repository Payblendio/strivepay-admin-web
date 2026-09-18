"use client";
import {useEffect} from "react";
import {confirmAction} from "./swal";
const owners=new Set<symbol>();
let confirmation:Promise<boolean>|null=null;
export async function confirmSupportLeave(){
  if(owners.size===0)return true;
  if(!confirmation)confirmation=confirmAction({
    title:"Leave this page?",
    text:"Your unsent support message or selected file will be lost.",
    confirmLabel:"Leave page",
  }).catch(()=>false).finally(()=>{confirmation=null;});
  return confirmation;
}
let navigating=false;
const approvedLinks=new WeakSet<HTMLAnchorElement>();
const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
const navigate=(event:MouseEvent)=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const element=event.target instanceof Element?event.target:null;
  const link=element?.closest("a[href]");
  if(!(link instanceof HTMLAnchorElement)||link.hasAttribute("download")||(link.target&&link.target!=="_self"))return;
  const destination=new URL(link.href,window.location.href);
  if(destination.origin!==window.location.origin||!["http:","https:"].includes(destination.protocol))return;
  if(destination.pathname===window.location.pathname&&destination.search===window.location.search)return;
  if(approvedLinks.delete(link)||owners.size===0)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(navigating)return;
  navigating=true;
  const original=window.location.href;
  void confirmSupportLeave().then(confirmed=>{
    if(!confirmed||!link.isConnected||window.location.href!==original||link.href!==destination.href)return;
    approvedLinks.add(link);
    // Replay through the existing Next.js link handler, not a full-page reload.
    link.click();
    approvedLinks.delete(link);
  }).finally(()=>{navigating=false;});
};
/** No content is persisted. Covers close/reload and ordinary same-tab internal links, not programmatic navigation. */
export function useSupportUnloadWarning(pending:boolean){
  useEffect(()=>{
    if(!pending)return;
    const owner=Symbol();owners.add(owner);
    if(owners.size===1){window.addEventListener("beforeunload",warn);document.addEventListener("click",navigate,true);}
    return()=>{
      owners.delete(owner);
      if(owners.size===0){window.removeEventListener("beforeunload",warn);document.removeEventListener("click",navigate,true);}
    };
  },[pending]);
}
