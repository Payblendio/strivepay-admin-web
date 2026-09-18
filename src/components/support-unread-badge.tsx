"use client";
import {useEffect,useState} from "react";
import {adminFetch} from "@/lib/admin-session";
import {connectSharedSupport} from "@/lib/support-shared-connection";
import "./support-unread-badge.css";
export function SupportUnreadBadge({scope="PERSONAL"}:{scope?:string}){
  const [count,setCount]=useState<number|null>(null);
  useEffect(()=>{
    let active=true;let pending:AbortController|undefined;
    setCount(null);
    const headers={"X-StrivePay-Account-Scope":scope};
    const refresh=()=>{
      pending?.abort();const controller=new AbortController();pending=controller;
      void adminFetch("/api/admin/support/unread",{headers,signal:controller.signal,cache:"no-store"}).then(async response=>{
        if(!response.ok)throw new Error("Unread unavailable");
        const data=await response.json();
        if(!Number.isSafeInteger(data.unreadMessages)||data.unreadMessages<0)throw new Error("Invalid count");
        if(active&&!controller.signal.aborted)setCount(data.unreadMessages);
      }).catch(()=>{if(active&&!controller.signal.aborted)setCount(null);});
    };
    const dispose=connectSharedSupport({scope,onChange:refresh,onState:state=>{if(state!=="connected"){pending?.abort();setCount(null);}},
      requestTicket:async signal=>{
        const response=await adminFetch("/api/admin/support/socket-ticket",{method:"POST",headers,signal});
        if(response.status===401||response.status===403)return null;
        if(!response.ok)throw new Error("Connection unavailable");
        return response.json();
      },
    });
    return()=>{active=false;pending?.abort();dispose();};
  },[scope]);
  if(count===null)return <span className="support-badge-unknown" aria-label="Unread support count unavailable" title="Unread count unavailable">·</span>;
  return count>0?<span className="support-nav-badge" aria-label={`${count} unread support messages`}>{count>99?"99+":count}</span>:null;
}
