"use client";
import {useEffect,useState} from "react";
type Context={partyId:string;displayName:string;accountType:string;accountStatus:string;country:string;joinedAt:string;openConversations:number};
type Props={ticketId:string;revision:number;request:(path:string,init?:RequestInit)=>Promise<unknown>};
export function SupportContext({ticketId,revision,request}:Props){
  const [context,setContext]=useState<Context|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0),[open,setOpen]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia("(min-width:1400px)");const update=()=>setOpen(media.matches);
    update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();setError(false);
    void request(`tickets/${ticketId}/context`,{signal:controller.signal}).then(value=>{
      const next=value as Context;
      if(!next?.partyId||!next.displayName)throw new Error("Invalid account context");
      if(!controller.signal.aborted)setContext(next);
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return()=>controller.abort();
  },[ticketId,revision,request,attempt]);
  return <details className="support-context" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>Account context</summary>
    {error?<p role="alert">Account details could not be updated. <button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry context</button></p>:null}
    {!context&&!error?<p role="status">Loading account details…</p>:null}
    {context?<div><h3>{context.displayName}</h3><dl>
      <dt>Account</dt><dd>{context.accountType==="ORGANIZATION"?"Business":"Personal"}</dd>
      <dt>Status</dt><dd>{context.accountStatus.toLowerCase()}</dd>
      <dt>Country</dt><dd>{context.country}</dd>
      <dt>Joined</dt><dd>{new Date(context.joinedAt).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})}</dd>
      <dt>Open conversations</dt><dd>{context.openConversations}</dd>
    </dl><a href={`/customers/${encodeURIComponent(context.partyId)}`} target="_blank" rel="noopener noreferrer">Open account <span aria-label="in a new tab">↗</span></a><p>Account status is not a verification decision.</p></div>:null}
  </details>;
}
