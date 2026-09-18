import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {OpsShell} from "@/components/ops-shell";
import {SandboxConsole} from "@/components/sandbox-console";
import {hasPermission,homePath,PERMISSIONS} from "@/lib/admin-access";
import {requireAdmin} from "@/lib/admin-session.server";

export const metadata:Metadata={title:"Bakkt sandbox"};
export default async function SandboxPage(){const {principal}=await requireAdmin(undefined,"/sandbox");if(!hasPermission(principal.permissions,PERMISSIONS.sandboxManage))redirect(homePath(principal.permissions));return <OpsShell principal={principal} eyebrow="Provider testing" title="Bakkt sandbox" copy="Run controlled compliance and transaction scenarios against sandbox-linked accounts."><SandboxConsole/></OpsShell>}
