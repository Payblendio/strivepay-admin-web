"use client";

import {createClientId} from "@/lib/client-id";
import {useEffect,useRef,useState} from "react";
import {useSupportUnloadWarning} from "@/lib/use-support-unload-warning";
import {adminFetch} from "@/lib/admin-session";
type Attachment={id:string;messageId:string;filename:string;contentType?:string;sizeBytes:number;internalNote:boolean};
const previewKind=(file:Pick<Attachment,"filename"|"contentType">)=>file.contentType?.toLowerCase()==="application/pdf"||/\.pdf$/i.test(file.filename)?"pdf":file.contentType?.toLowerCase().startsWith("image/")||/\.(png|jpe?g)$/i.test(file.filename)?"image":null;
type Props={ticketId:string;revision:number;scope:string;canUpload:boolean;internal:boolean;showFiles?:boolean;request:(path:string,init?:RequestInit)=>Promise<unknown>;onUploaded:()=>void;onBusyChange?:(busy:boolean)=>void};
export function SupportAttachments({ticketId,revision,scope,canUpload,internal,showFiles=true,request,onUploaded,onBusyChange}:Props){
  const [files,setFiles]=useState<Attachment[]>([]),[previews,setPreviews]=useState<Record<string,string>>({}),[selected,setSelected]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  useSupportUnloadWarning(busy||selected!==null);
  const pending=useRef<{clientId:string;attachmentId:string;messageId?:string;internal:boolean}|null>(null);
  const abort=useRef<AbortController|null>(null),input=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
  useEffect(()=>{
    if(!showFiles){setFiles([]);return;}
    const controller=new AbortController();
    setLoading(true);setLoadError("");
    void request(`tickets/${ticketId}/attachments`,{signal:controller.signal}).then(value=>{
      if(!Array.isArray(value))throw new Error("Invalid file list");
      if(!controller.signal.aborted)setFiles(value as Attachment[]);
    }).catch(()=>{if(!controller.signal.aborted)setLoadError("Files could not be loaded.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[request,ticketId,revision,attempt,showFiles]);
  useEffect(()=>{
    if(!showFiles){setPreviews({});return;}
    const controller=new AbortController();
    setPreviews({});
    const urls:string[]=[];
    void (async()=>{
      const next:Record<string,string>={};
      for(const file of files){
        if(!previewKind(file))continue;
        try{
          const response=await adminFetch(`/api/admin/support/tickets/${ticketId}/attachments/${file.id}?preview=1`,{signal:controller.signal,headers:{}});
          if(!response.ok)continue;
          const url=URL.createObjectURL(await response.blob());urls.push(url);next[file.id]=url;
        }catch{if(controller.signal.aborted)return;}
      }
      if(!controller.signal.aborted)setPreviews(next);
    })();
    return()=>{controller.abort();urls.forEach(url=>URL.revokeObjectURL(url));};
  },[files,ticketId,showFiles]);
  function choose(file:File|null){
    if(busy)return;setError("");pending.current=null;
    if(file&&(file.size===0||file.size>10*1024*1024)){setSelected(null);setError("Choose a non-empty file up to 10 MB.");return;}
    setSelected(file);
  }
  async function upload(){
    if(!selected||busy||!canUpload)return;
    setBusy(true);setError("");abort.current=new AbortController();
    pending.current??={clientId:createClientId(),attachmentId:createClientId(),internal};
    const job=pending.current;
    try{
      if(!job.messageId){
        const message=await request(`tickets/${ticketId}/messages`,{method:"POST",signal:abort.current.signal,body:JSON.stringify({body:`Shared file: ${selected.name}`,clientMessageId:job.clientId,internalNote:job.internal})}) as {id:string};
        job.messageId=message.id;
      }
      const response=await adminFetch(`/api/admin/support/tickets/${ticketId}/messages/${job.messageId}/attachments/${job.attachmentId}`,{method:"POST",signal:abort.current.signal,headers:{"Content-Type":"application/octet-stream","X-File-Name":encodeURIComponent(selected.name),},body:selected});
      if(!response.ok){const problem=await response.json().catch(()=>({}));throw new Error(problem.title||"The file could not be uploaded.");}
      setSelected(null);pending.current=null;if(input.current)input.current.value="";onUploaded();setAttempt(value=>value+1);
    }catch(e){if(!abort.current?.signal.aborted)setError((e instanceof Error?e.message:"Upload failed.")+(job.messageId?" Your message is saved; retry to attach the file.":""));}
    finally{setBusy(false);}
  }
  async function download(file:Attachment){
    setError("");setBusy(true);abort.current=new AbortController();
    try{
      const response=await adminFetch(`/api/admin/support/tickets/${ticketId}/attachments/${file.id}`,{signal:abort.current.signal,headers:{}});
      if(!response.ok)throw new Error("This file could not be downloaded.");
      const blob=await response.blob();if(abort.current.signal.aborted)return;
      const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=file.filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){if(!abort.current?.signal.aborted)setError(e instanceof Error?e.message:"Download failed.");}finally{setBusy(false);}
  }
  return <section className="support-attachments" aria-label="Conversation files">
    <h3>Files</h3>
    {showFiles&&loading?<p role="status">Loading files…</p>:null}
    {showFiles&&files.length?<ul>{files.map(file=>{const kind=previewKind(file),preview=previews[file.id];return <li key={file.id} className="support-file"><div className="support-file-preview">{preview&&kind==="image"?<img src={preview} alt={`Preview of ${file.filename}`}/>:null}{preview&&kind==="pdf"?<iframe src={preview} title={`Preview of ${file.filename}`}/>:null}</div><div className="support-file-meta"><button type="button" disabled={busy} onClick={()=>void download(file)}>{file.filename}</button><span>{Math.ceil(file.sizeBytes/1024)} KB{file.internalNote?" · Staff only":""}</span></div></li>})}</ul>:showFiles&&!loading&&!loadError?<p>No files shared yet.</p>:null}
    {showFiles&&loadError?<p role="alert">{loadError} <button type="button" disabled={busy||loading} onClick={()=>setAttempt(value=>value+1)}>Reload files</button></p>:null}
    {canUpload?<div className="support-upload"><label>Attach a file<input ref={input} type="file" accept=".png,.jpg,.jpeg,.pdf" disabled={busy} onChange={event=>choose(event.target.files?.[0]??null)}/></label><span>{selected?`${selected.name} · ${Math.ceil(selected.size/1024)} KB ready`:`PNG, JPEG or scanned PDF · up to 10 MB · ${pending.current?.internal??internal?"Staff only":"Visible to everyone in this conversation"}`}</span>{selected?<><button type="button" disabled={busy} onClick={()=>void upload()}>{busy?"Uploading…":pending.current?.messageId?"Retry upload":"Upload file"}</button><button type="button" disabled={busy} onClick={()=>{setSelected(null);pending.current=null;if(input.current)input.current.value="";setError("");}}>Remove</button></>:null}</div>:null}
    {error?<p role="alert">{error}</p>:null}
  </section>;
}
