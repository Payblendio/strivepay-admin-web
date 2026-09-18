"use client";

import {createClientId} from "@/lib/client-id";
import {confirmAction} from "@/lib/swal";
import {useCallback, useEffect, useRef, useState, type FormEvent} from "react";
import {IconArrowLeft, IconMessageCircle, IconPlus, IconRefresh, IconSend} from "@tabler/icons-react";
import {type SupportConnectionState, type SupportConnectionTicket} from "@/lib/support-connection";
import {connectSharedSupport} from "@/lib/support-shared-connection";
import {adminFetch} from "@/lib/admin-session";
import "./support-workspace.css";
import {SupportFeedback} from "./support-feedback";
import {SupportAttachments} from "./support-attachments";
import {SupportLinkedActivity} from "./support-linked-activity";
import {SupportAuditTrail} from "./support-audit-trail";
import {useSupportUnloadWarning} from "@/lib/use-support-unload-warning";
import {SupportContext} from "./support-context";
import {SupportAssignment} from "./support-assignment";

type Ticket={id:string;number:number;subject:string;category:string;status:string;updatedAt:string;unreadCount:number;partyId:string;priority:string|null;assignedAdminId:string|null};
type Message={id:string;sequence:number;senderType:string;body:string;internalNote:boolean;createdAt:string};
type History={items:Message[];before:number|null;hasMore:boolean};
const mergeMessages=(current:Message[],incoming:Message[])=>Array.from(new Map([...current,...incoming].map(message=>[message.id,message])).values()).sort((a,b)=>a.sequence-b.sequence);
const statuses=["OPEN","IN_PROGRESS","WAITING_ON_CUSTOMER","RESOLVED","CLOSED"];
const label=(value:string)=>value.toLowerCase().replaceAll("_"," ");
const date=(value:string)=>new Date(value).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
export function SupportWorkspace({scope="PERSONAL",canWrite=true,permissions=[],initialTicket=null}:{scope?:string;canWrite?:boolean;permissions?:string[];initialTicket?:string|null}) {
  const initial=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(initialTicket??"")?initialTicket:null;
  const admin=true;
  const canReply=admin?permissions.includes("support.reply"):canWrite;
  const canNote=admin&&permissions.includes("support.notes");
  const canManage=admin?permissions.includes("support.manage"):canWrite;
  const [tickets,setTickets]=useState<Ticket[]>([]),[selected,setSelected]=useState<string|null>(initial);
  const [thread,setThread]=useState<Ticket|null>(null),[messages,setMessages]=useState<Message[]>([]);
  const [filter,setFilter]=useState(""),[page,setPage]=useState(0),[revision,setRevision]=useState(0);
  const [search,setSearch]=useState(""),[query,setQuery]=useState(""),[assignment,setAssignment]=useState("ALL");
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [attachmentBusy,setAttachmentBusy]=useState(false);
  const workspaceRef=useRef<HTMLElement|null>(null);
  const hasMounted=useRef(false);
  const [listError,setListError]=useState(""),[threadError,setThreadError]=useState("");
  const [creating,setCreating]=useState(false),[draft,setDraft]=useState(""),[subject,setSubject]=useState(""),[category,setCategory]=useState("ACCOUNT"),[note,setNote]=useState(false);
  const [connection,setConnection]=useState<SupportConnectionState>("connecting");
  useEffect(()=>{
    if(!hasMounted.current){hasMounted.current=true;return;}
    if(window.innerWidth<=760)workspaceRef.current?.scrollIntoView?.({block:"start",behavior:"instant"});
  },[selected,creating]);
  const sendId=useRef<string|null>(null),createId=useRef<string|null>(null);
  const activity=useRef({ticketId:initial as string|null,typingUntil:0});
  const [typing,setTyping]=useState("");
  const drafts=useRef(new Map<string,{body:string;id:string|null}>());
  useSupportUnloadWarning(busy||attachmentBusy||!!draft.trim()||!!subject.trim()||Array.from(drafts.current.values()).some(value=>!!value.body.trim()));
  const draftKey=(id:string|null,internal=false)=>id?`${id}:${internal?"note":"reply"}`:"new";
  function editDraft(body:string){
    activity.current.typingUntil=!note&&body.trim()?Date.now()+4500:0;
    setDraft(body);sendId.current=null;
    if(creating)createId.current=null;
    drafts.current.set(draftKey(selected,note),{body,id:null});
  }
  function changeNote(internal:boolean){
    if(busy||attachmentBusy)return;
    activity.current.typingUntil=0;
    drafts.current.set(draftKey(selected,note),{body:draft,id:sendId.current});
    const saved=drafts.current.get(draftKey(selected,internal));
    setNote(internal);setDraft(saved?.body??"");sendId.current=saved?.id??null;
  }
  const historyCursor=useRef<{id:string;latest:number}|null>(null);
  const selectedRef=useRef<string|null>(initial);
  const [older,setOlder]=useState<{before:number|null;hasMore:boolean}>({before:null,hasMore:false});
  const refresh=useCallback(()=>setRevision(value=>value+1),[]);
  const request=useCallback(async(path:string,init:RequestInit={})=>{
    const response=await adminFetch(`/api/admin/support/${path}`,{...init,cache:"no-store",headers:{"Content-Type":"application/json", ...init.headers}});
    if(!response.ok){const problem=await response.json().catch(()=>({}));throw new Error(problem.title||"Support could not be loaded. Please try again.");}
    return response.status===204?null:response.json();
  },[scope]);
  useEffect(()=>connectSharedSupport({scope,
    requestTicket:async signal=>{
      const response=await adminFetch("/api/admin/support/socket-ticket",{method:"POST",signal,headers:{}});
      if(response.status===401||response.status===403)return null;
      if(!response.ok)throw new Error("Connection unavailable");
      return await response.json() as SupportConnectionTicket;
    },onChange:refresh,onState:state=>{setConnection(state);if(state!=="connected")setTyping("");},
    activity:()=>({ticketId:activity.current.ticketId,typing:Date.now()<activity.current.typingUntil}),
    onTyping:state=>{if(state.ticketId===selectedRef.current)setTyping(state.agent?"Support team is typing…":state.customer?"Customer is typing…":"");},
  }),[scope,refresh]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);
    void request(`tickets?page=${page}&size=30&q=${encodeURIComponent(query)}&assignment=${assignment}${filter?"&status="+filter:""}`,{signal:controller.signal})
      .then(items=>{if(!controller.signal.aborted){setTickets(items);setListError("");}}).catch(e=>{if(!controller.signal.aborted)setListError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[request,page,filter,revision,query,assignment]);
  useEffect(()=>{
    if(!selected)return;
    const controller=new AbortController();
    async function sync(){
      const ticket:Ticket=await request(`tickets/${selected}`,{signal:controller.signal});
      let items:Message[]=[];
      let cursor=historyCursor.current?.id===selected?historyCursor.current.latest:null;
      if(cursor===null){
        const history:History=await request(`tickets/${selected}/history?size=50`,{signal:controller.signal});
        items=history.items;
        if(!controller.signal.aborted)setOlder({before:history.before,hasMore:history.hasMore});
      }else{
        let batch:Message[];
        do{
          batch=await request(`tickets/${selected}/messages?size=100&after=${cursor}`,{signal:controller.signal});
          items.push(...batch);
          if(batch.length)cursor=batch.at(-1)!.sequence;
        }while(batch.length===100&&!controller.signal.aborted);
      }
        if(controller.signal.aborted)return;
        setThreadError("");setThread(ticket);setMessages(current=>mergeMessages(current,items));
        historyCursor.current={id:selected!,latest:items.at(-1)?.sequence??cursor??0};
        if(document.visibilityState==="visible"&&items.length)void request(`tickets/${selected}/read`,{method:"POST",body:JSON.stringify({sequence:items.at(-1)!.sequence}),signal:controller.signal}).catch(()=>{});
    }
    void sync().catch(e=>{if(!controller.signal.aborted)setThreadError(e.message);});
    return()=>controller.abort();
  },[selected,request,revision]);
  function choose(id:string|null,force=false){
    if((busy||attachmentBusy)&&!force)return false;
    // Selecting the open thread must not erase state without changing the effect key.
    if(id!==null&&id===selected&&!creating)return true;
    if(window.location.pathname==="/support"){
      const url=new URL(window.location.href);
      if(id)url.searchParams.set("ticket",id);else url.searchParams.delete("ticket");
      window.history.replaceState(null,"",url.pathname+url.search+url.hash);
    }
    setThreadError("");
    activity.current={ticketId:id,typingUntil:0};setTyping("");
    selectedRef.current=id;historyCursor.current=null;setOlder({before:null,hasMore:false});setSelected(id);setThread(null);setMessages([]);setCreating(false);setNote(false);setError("");
    const saved=drafts.current.get(draftKey(id));setDraft(saved?.body??"");sendId.current=saved?.id??null;
    return true;
  }
  async function submit(event:FormEvent){
    event.preventDefault();if(busy||attachmentBusy)return;setBusy(true);setError("");
    activity.current.typingUntil=0;
    try{
      if(creating){
        createId.current??=createClientId();
        const ticket=await request("tickets",{method:"POST",body:JSON.stringify({subject,category,body:draft,clientMessageId:createId.current})});
        createId.current=null;drafts.current.delete("new");setSubject("");choose(ticket.id,true);refresh();
      }else if(selected){
        sendId.current??=createClientId();
        drafts.current.set(draftKey(selected,note),{body:draft,id:sendId.current});
        await request(`tickets/${selected}/messages`,{method:"POST",body:JSON.stringify({body:draft,clientMessageId:sendId.current,internalNote:note})});
        drafts.current.delete(draftKey(selected,note));sendId.current=null;setDraft("");refresh();
      }
    }catch(e){setError(e instanceof Error?e.message:"Message could not be sent. Your draft is retained.");}
    finally{setBusy(false);}
  }
  async function changeStatus(status:string){
    if(!selected||attachmentBusy||busy)return;
    const ticketId=selected;setBusy(true);setError("");
    try{
      if(status==="RESOLVED"&&!(await confirmAction({title:"Mark conversation resolved?",text:"Mark this conversation resolved for the customer? They can still reopen it if they need more help.",confirmLabel:"Mark resolved",tone:"info",showCancelButton:true})))return;
      if(status==="OPEN"&&thread&&["RESOLVED","CLOSED"].includes(thread.status)&&!(await confirmAction({title:"Reopen conversation?",text:"Reopen this conversation so the customer can continue the thread.",confirmLabel:"Reopen conversation",tone:"info",showCancelButton:true})))return;
      if(selectedRef.current!==ticketId)return;
      await request(`tickets/${ticketId}/status`,{method:"POST",body:JSON.stringify({status})});refresh();
    }
    catch(e){setError(e instanceof Error?e.message:"Could not update conversation.");}finally{setBusy(false);}
  }
  async function nextMessages(){
    if(!selected||!older.hasMore||older.before===null)return;setBusy(true);
    const requested=selected;
    try{const history:History=await request(`tickets/${selected}/history?size=50&before=${older.before}`);if(selectedRef.current!==requested)return;setMessages(current=>mergeMessages(current,history.items));setOlder({before:history.before,hasMore:history.hasMore});}
    catch{setError("More messages could not be loaded.");}finally{setBusy(false);}
  }
  const closed=thread&&["RESOLVED","CLOSED"].includes(thread.status);
  return <section ref={workspaceRef} className={`support-workspace ${selected||creating?"has-thread":""}`} aria-label={admin?"Support inbox":"Your support conversations"}>
    <aside className="support-inbox">
      <header><h2>{admin?"Inbox":"Conversations"}</h2>{!admin&&canWrite?<button className="support-primary" disabled={busy} onClick={()=>{if(choose(null))setCreating(true);}}><IconPlus size={16}/>New request</button>:null}</header>
      <label className="support-filter">Status<select value={filter} onChange={event=>{setFilter(event.target.value);setPage(0);}}><option value="">All conversations</option>{statuses.map(status=><option key={status} value={status}>{label(status)}</option>)}</select></label>
      <form className="support-search" role="search" onSubmit={event=>{event.preventDefault();setPage(0);setQuery(search.trim());}}>
        <label htmlFor="support-search">Find a conversation</label><div><input id="support-search" type="search" maxLength={180} placeholder="Subject or request number" value={search} onChange={event=>setSearch(event.target.value)}/><button>Search</button></div>
        {query?<button type="button" onClick={()=>{setSearch("");setQuery("");setPage(0);}}>Clear search</button>:null}
      </form>
      {admin?<label className="support-filter">Assigned to<select value={assignment} onChange={event=>{setAssignment(event.target.value);setPage(0);}}><option value="ALL">All agents</option><option value="MINE">Assigned to me</option><option value="UNASSIGNED">Unassigned</option></select></label>:null}
      <div className="support-list" aria-busy={loading}>
        {listError?<div className="support-error" role="alert">{listError}<button onClick={refresh}>Retry conversations</button></div>:null}
        {!tickets.length?<p className="support-muted">{loading?"Loading conversations…":"No conversations here yet."}</p>:tickets.map(ticket=><button key={ticket.id} className={`support-ticket ${selected===ticket.id?"selected":""}`} aria-pressed={selected===ticket.id} onClick={()=>choose(ticket.id)}>
          <span className="support-ticket-meta">#{ticket.number}<span>{date(ticket.updatedAt)}</span></span><strong>{ticket.subject}</strong><span className="support-ticket-bottom"><span className="support-status">{label(ticket.status)}</span>{ticket.unreadCount>0?<span className="support-unread" aria-label={`${ticket.unreadCount} unread messages`}>{ticket.unreadCount}</span>:null}</span>
        </button>)}
      </div>
      <footer><button disabled={page===0||loading} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1}</span><button disabled={tickets.length<30||loading} onClick={()=>setPage(p=>p+1)}>Next</button></footer>
      <p className="support-connection" role="status">{connection==="connected"?"Updates connected":connection==="expired"?"Sign in again to reconnect":connection==="offline"?"Offline · your draft stays here":"Reconnecting updates…"}</p>
    </aside>
    <div className="support-conversation">
      <div className="support-toolbar"><button className="support-back" onClick={()=>choose(null)}><IconArrowLeft size={17}/>Conversations</button><button aria-label="Refresh support" onClick={refresh}><IconRefresh size={17}/></button></div>
      {threadError?<div className="support-error" role="alert">{threadError}<button onClick={refresh}>Retry conversation</button></div>:null}
      {error?<div className="support-error" role="alert">{error}</div>:null}
      {creating?<form className="support-new" onSubmit={submit}><span className="support-eyebrow">A little context helps</span><h2>How can we help?</h2><p>Tell us what happened and what you need help with.</p>
        <label>Subject<input required maxLength={180} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="A short summary"/></label>
        <label>Topic<select value={category} onChange={e=>setCategory(e.target.value)}>{["ACCOUNT","VERIFICATION","BUY","SELL","TRANSFER","OTHER"].map(item=><option key={item} value={item}>{label(item)}</option>)}</select></label>
        <label>Message<textarea required maxLength={10000} rows={5} value={draft} disabled={busy} onChange={e=>editDraft(e.target.value)}/></label><p className="support-safety">Never share passwords, verification codes or wallet recovery phrases.</p><button className="support-primary" disabled={busy||!draft.trim()||!subject.trim()}>{busy?"Sending…":"Send request"}<IconSend size={16}/></button>
      </form>:selected?<>{thread?<header className="support-thread-heading"><span className="support-eyebrow">#{thread.number} · {label(thread.category)}</span><h2>{thread.subject}</h2><div><span className="support-status">{label(thread.status)}</span>{canManage?(admin?<select aria-label="Conversation status" disabled={busy} value={thread.status} onChange={e=>void changeStatus(e.target.value)}>{statuses.map(s=><option key={s} value={s}>{label(s)}</option>)}</select>:<button disabled={busy} onClick={()=>void changeStatus(closed?"OPEN":"RESOLVED")}>{closed?"Reopen conversation":"Mark resolved"}</button>):null}</div></header>:<p className="support-muted">Loading conversation…</p>}
        {thread&&canManage?<SupportAssignment key={`${thread.id}:${thread.assignedAdminId}:${thread.priority}`} ticketId={thread.id} assignedAdminId={thread.assignedAdminId} priority={thread.priority} request={request} onSaved={refresh}/>:null}
        <div className="support-messages" aria-label="Conversation messages">{older.hasMore?<button disabled={busy} onClick={()=>void nextMessages()}>Load earlier messages</button>:null}{messages.map(message=><article key={message.id} className={`support-message ${message.internalNote?"internal":message.senderType===(admin?"ADMIN":"CUSTOMER")?"outgoing":"incoming"}`}><header><strong>{message.internalNote?"Internal note":message.senderType==="ADMIN"?"Support team":"Customer"}</strong><time dateTime={message.createdAt}>{date(message.createdAt)}</time></header><p>{message.body}</p></article>)}</div>
        {typing?<p className="support-connection" role="status">{typing}</p>:null}
        {thread&&permissions.includes("transactions.view")?<SupportLinkedActivity key={`activity:${thread.id}`} ticketId={thread.id} revision={revision} request={request}/>:null}
        {attachmentBusy?<p className="support-connection" role="status">File transfer in progress. Please wait before changing conversations.</p>:null}
        {thread?<SupportAttachments key={`files:${thread.id}`} ticketId={thread.id} revision={revision} scope={scope} canUpload={false} internal={note} request={request} onUploaded={refresh} onBusyChange={setAttachmentBusy}/>:null}
        {thread&&!closed&&(canReply||canNote)?<form className={`support-composer ${note?"is-note":""}`} onSubmit={submit}><label htmlFor="support-reply">{note?"Add an internal note":"Reply"}</label><textarea id="support-reply" required maxLength={10000} rows={3} value={draft} disabled={busy} onChange={e=>editDraft(e.target.value)} placeholder={note?"Keep investigation details here":"Write your message…"}/><SupportAttachments key={`composer-files:${thread.id}:${note}`} ticketId={thread.id} revision={revision} scope={scope} canUpload={note?canNote:canReply} internal={note} showFiles={false} request={request} onUploaded={refresh} onBusyChange={setAttachmentBusy}/><p className="support-safety">No passwords or verification codes.</p><div className="support-composer-actions">{canNote?<label className="support-note-toggle"><input type="checkbox" checked={note} disabled={busy} onChange={e=>changeNote(e.target.checked)}/>Internal note · only visible to staff</label>:<span/>}<button type="submit" className="support-primary" disabled={busy||!draft.trim()||(!note&&!canReply)}>{busy?"Sending…":note?"Save note":"Send reply"}<IconSend size={16}/></button></div></form>:thread?<p className="support-closed">{closed?"This conversation is resolved. Reopen it if you still need help.":"Your role can view this conversation."}</p>:null}
        {thread&&(admin||closed)?<SupportFeedback key={`feedback:${thread.id}`} ticketId={thread.id} revision={revision} readOnly={admin||!canWrite} request={request}/>:null}
        {thread&&admin?<SupportAuditTrail key={`audit:${thread.id}`} ticketId={thread.id} revision={revision} request={request}/>:null}
      </>:<div className="support-empty"><IconMessageCircle size={40} stroke={1.3}/><h2>{admin?"Every conversation, in context":"Help with your next move"}</h2><p>{admin?"Choose a conversation to review the history and respond.":"Ask about your account, verification or a transfer. Your conversations stay together here."}</p>{!admin&&canWrite?<button className="support-primary" disabled={busy} onClick={()=>{if(choose(null))setCreating(true);}}>Start a conversation<IconPlus size={16}/></button>:null}</div>}
    </div>
    {thread&&permissions.includes("customers.view")?<SupportContext key={`context:${thread.id}`} ticketId={thread.id} revision={revision} request={request}/>:null}
  </section>;
}
