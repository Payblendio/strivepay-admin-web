import {OpsShell} from "@/components/ops-shell";
import {SupportWorkspace} from "@/components/support-workspace";
import {requireAdmin} from "@/lib/admin-session.server";
import {supportId} from "@/lib/support-investigation";
export const metadata={title:"Support"};
export default async function SupportPage({searchParams}:{searchParams:Promise<{ticket?:string|string[]}>}){
  const {ticket}=await searchParams;
  const parsed=supportId.safeParse(ticket);
  const selected=parsed.success?parsed.data:null;
  const {principal}=await requireAdmin("support.view",selected?`/support?ticket=${selected}`:"/support");
  return <OpsShell principal={principal} eyebrow="Customer care" title="Support" copy="Keep every request moving, with context and a clear next step."><SupportWorkspace key={selected??"inbox"} permissions={principal.permissions} initialTicket={selected}/></OpsShell>;
}
