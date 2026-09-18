"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {connectSharedSupport} from "@/lib/support-shared-connection";
import {adminFetch} from "@/lib/admin-session";
import type {SupportConnectionTicket} from "@/lib/support-connection";
export function TransactionRealtimeRefresh(){
  const router=useRouter();
  useEffect(()=>connectSharedSupport({scope:"admin",requestTicket:async signal=>{const response=await adminFetch("/api/admin/support/socket-ticket",{method:"POST",signal});if(response.status===401||response.status===403)return null;if(!response.ok)throw new Error("Realtime connection unavailable");return await response.json() as SupportConnectionTicket;},onChange:()=>{},onTransactionChange:()=>router.refresh(),onState:()=>{}}),[router]);
  return null;
}
