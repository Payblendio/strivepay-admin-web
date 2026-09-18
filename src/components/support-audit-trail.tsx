"use client";
import {useEffect,useState} from "react";

type Event={id:number;type:string;actorType:string;actorName:string;createdAt:string;status:string|null;priority:string|null;assignedAdminId:string|null};
type Page={items:Event[];before:number|null;hasMore:boolean};
type Props={ticketId:string;revision:number;request:(path:string,init?:RequestInit)=>Promise<unknown>};
const labels:Record<string,string>={"ticket.created":"Conversation opened","message.created":"Public message sent","note.created":"Internal note added","ticket.status":"Status changed","ticket.assigned":"Assignment or priority changed","feedback.updated":"Feedback updated","attachment.created":"File attached"};
function parse(value:unknown):Page{
 const page=value as Page;
 if(!page||!Array.isArray(page.items)||page.items.length>100||typeof page.hasMore!=="boolean"||!(page.before===null||(Number.isSafeInteger(page.before)&&page.before>0))||page.hasMore&&page.before===null)throw new Error("Invalid audit history");
 for(const e of page.items){
  if(!e||!Number.isSafeInteger(e.id)||e.id<=0||typeof e.type!=="string"||typeof e.actorType!=="string"||typeof e.actorName!=="string"||typeof e.createdAt!=="string"||!Number.isFinite(Date.parse(e.createdAt))||![e.status,e.priority,e.assignedAdminId].every(v=>v===null||typeof v==="string"))throw new Error("Invalid audit event");
 }
 return page;
}
export function SupportAuditTrail(props:Props){
 const [open,setOpen]=useState(false);
 return <details className="support-audit" onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>Staff activity history</summary>
  {open&&<AuditEvents key={`${props.ticketId}:${props.revision}`} {...props}/>}
 </details>;
}
function AuditEvents({ticketId,request}:Props){
 const [items,setItems]=useState<Event[]>([]),[before,setBefore]=useState<number|null>(null),[next,setNext]=useState<number|null>(null);
 const [busy,setBusy]=useState(true),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setBusy(true);setError(false);
  void request(`tickets/${ticketId}/events?size=30${before===null?"":`&before=${before}`}`,{signal:controller.signal}).then(parse).then(page=>{
   if(controller.signal.aborted)return;
   if(page.hasMore&&(page.before===null||before!==null&&page.before>=before))throw new Error("Invalid history cursor");
   setItems(current=>before===null?page.items:[...new Map([...current,...page.items].map(item=>[item.id,item])).values()]);
   setNext(page.hasMore?page.before:null);
  }).catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[ticketId,request,before,attempt]);
 return <div aria-busy={busy}>
  <p className="support-safety">Staff only · newest first. Older entries may not include change details.</p>
  <ol>{items.map(event=><li key={event.id}>
   <strong>{labels[event.type]??"Support activity recorded"}</strong>
   <span>{event.actorName} · <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></span>
   {event.type==="ticket.status"&&event.status&&<span>Status: {event.status.replaceAll("_"," ")}</span>}
   {event.type==="ticket.assigned"&&event.priority&&<span>Priority: {event.priority.toLowerCase()} · {event.assignedAdminId?`Agent reference: ${event.assignedAdminId}`:"Unassigned"}</span>}
  </li>)}</ol>
  {error?<p role="alert">Activity history unavailable. <button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry history</button></p>:busy?<p role="status">Loading activity history…</p>:items.length===0?<p>No activity recorded.</p>:null}
  {!error&&next!==null&&<button type="button" disabled={busy} onClick={()=>setBefore(next)}>Load older activity</button>}
 </div>;
}
