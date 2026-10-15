import {OpsShell} from "@/components/ops-shell";
import {RateAlertsPanel} from "@/components/rate-alerts-panel";
import {requireAdmin} from "@/lib/admin-session.server";
import {PERMISSIONS} from "@/lib/admin-access";

export default async function RateAlertsPage(){
  const {principal}=await requireAdmin(PERMISSIONS.rateAlertsManage,"/rate-alerts");
  return <OpsShell principal={principal} eyebrow="Platform" title="Rate alerts" copy="Schedule combined rate updates and manage carefully targeted sends."><RateAlertsPanel/></OpsShell>;
}
