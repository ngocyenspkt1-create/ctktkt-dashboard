import {redirect} from "next/navigation";
import {requireAdmin} from "@/lib/auth/server";
import {AppShell} from "@/components/app-shell";
import {DataBackupPanel} from "@/components/data-backup-panel";

export const dynamic="force-dynamic";
export default async function DataBackupPage(){
  const guard=await requireAdmin();
  if(!guard.ok)redirect("/");
  return <AppShell active="data-backup"><DataBackupPanel/></AppShell>;
}
